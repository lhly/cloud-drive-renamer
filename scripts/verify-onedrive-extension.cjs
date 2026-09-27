const { chromium, expect } = require('@playwright/test');
const { existsSync } = require('node:fs');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { basename, join, resolve } = require('node:path');

const project = resolve(__dirname, '..');
const base = 'https://onedrive.live.com/personal/0123456789abcdef';
const siteId = '11111111-1111-4111-8111-111111111111';
const listId = '22222222-2222-4222-8222-222222222222';
const rootId = 'ROOT';
const driveId = 'DRIVE';
const files = [
  { id: 'FILE1', guid: '33333333-3333-4333-8333-333333333333', name: 'alpha.txt', version: 1 },
  { id: 'FILE2', guid: '44444444-4444-4444-8444-444444444444', name: 'beta.txt', version: 1 },
];
const root = { id: rootId, name: 'Documents', folder: {}, parentReference: { driveId }, eTag: '"root,1"' };
const calls = [];
const errors = [];
let context;
let profile;

function item(file) {
  return {
    id: file.id,
    name: file.name,
    file: {},
    size: 12,
    eTag: `"${file.guid},${file.version}"`,
    parentReference: { driveId, id: rootId, path: '/drive/root:', name: 'Documents' },
    sharepointIds: { siteId, listId, listItemUniqueId: file.guid },
    fileSystemInfo: { lastModifiedDateTime: '2026-09-27T00:00:00Z' },
    lastModifiedDateTime: '2026-09-27T00:00:00Z',
  };
}

function getBrowserOptions() {
  const configuredPath = process.env.CDR_BROWSER_PATH;
  if (configuredPath) {
    if (!existsSync(configuredPath)) throw new Error(`CDR_BROWSER_PATH does not exist: ${configuredPath}`);
    return { executablePath: configuredPath };
  }

  if (process.platform === 'darwin') {
    const candidates = [
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ];
    const executablePath = candidates.find((candidate) => existsSync(candidate));
    if (executablePath) return { executablePath };
  }

  return {};
}

async function main() {
  profile = await mkdtemp(join(tmpdir(), 'cdr-onedrive-e2e-'));
  const screenshotPath = join(tmpdir(), `${basename(profile)}.png`);
  const browserOptions = getBrowserOptions();
  context = await chromium.launchPersistentContext(profile, {
    ...browserOptions,
    ...(!browserOptions.executablePath ? { channel: 'chromium' } : {}),
    headless: true,
    viewport: { width: 1440, height: 960 },
    args: [
      `--disable-extensions-except=${join(project, 'dist')}`,
      `--load-extension=${join(project, 'dist')}`,
    ],
  });

  await context.route('https://onedrive.live.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = decodeURIComponent(url.pathname);
    calls.push({ method: request.method(), path, search: url.search });
    const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });

    if (!path.includes('/_api/')) {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><head><title>OneDrive extension fixture</title></head><body><h1>My files</h1><input id="site-input"><script>
          window._spPageContextInfo={webAbsoluteUrl:${JSON.stringify(base)},listUrl:'/personal/0123456789abcdef/Documents'};
          window.siteKeyEvents=[];
          for (const type of ['keydown','keypress','keyup']) {
            document.addEventListener(type, event => {
              window.siteKeyEvents.push(type);
              if (event.target.tagName === 'FILE-SELECTOR-PANEL') {
                event.preventDefault();
                document.getElementById('site-input').focus();
              }
            });
          }
        </script></body></html>`,
      });
    }
    if (path.endsWith('/_api/contextinfo')) return json({ FormDigestValue: 'fixture-digest', FormDigestTimeoutSeconds: 1800 });
    if (path.endsWith('/drive/root') || path.endsWith('/drive/items/ROOT')) return json(root);
    if (path.endsWith('/children')) {
      if (url.searchParams.has('page')) return json({ value: [item(files[1])] });
      return json({
        value: [item(files[0]), { id: 'FOLDER', name: 'Folder', folder: {}, parentReference: { id: rootId, driveId } }],
        '@odata.nextLink': `${base}/_api/v2.0/drive/items/ROOT/children?page=2`,
      });
    }

    const driveMatch = path.match(/\/drive\/items\/([^/]+)$/);
    if (driveMatch) {
      const file = files.find((entry) => entry.id === driveMatch[1]);
      return file ? json(item(file)) : json({ error: { code: 'notFound' } }, 404);
    }

    const guidMatch = path.match(/GetFileById\('([^']+)'\)/);
    if (guidMatch) {
      const file = files.find((entry) => entry.guid === guidMatch[1]);
      if (!file) return json({ error: { code: 'notFound' } }, 404);
      if (request.method() === 'POST') {
        const body = request.postDataJSON();
        if (request.headers()['if-match'] !== `"${file.version}"`) return json({ error: { code: 'preconditionFailed' } }, 412);
        if (request.headers()['x-requestdigest'] !== 'fixture-digest') return json({ error: { code: 'accessDenied' } }, 403);
        file.name = body.FileLeafRef;
        file.version++;
        return route.fulfill({ status: 204 });
      }
      if (path.endsWith('/ListItemAllFields')) {
        return json({
          d: {
            __metadata: { type: 'SP.Data.DocumentsItem', etag: `"${file.version}"` },
            FileLeafRef: file.name,
            FileRef: `/personal/0123456789abcdef/Documents/${file.name}`,
            FileDirRef: '/personal/0123456789abcdef/Documents',
          },
        });
      }
      return json({ Name: file.name, UniqueId: file.guid });
    }

    return json({ error: { code: 'unexpectedRoute' } }, 404);
  });

  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 10000 });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('https://onedrive.live.com/my');

  const button = page.locator('#cloud-drive-renamer-floating-button');
  await expect(button).toBeVisible({ timeout: 10000 });
  await button.click();
  await expect(page.getByText('alpha.txt', { exact: true }).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('beta.txt', { exact: true }).first()).toBeVisible();

  await page.locator('[data-rule-panel-type="prefix"] .rule-panel-header').click();
  const prefix = page.locator('[data-rule-panel-type="prefix"] input[type="text"]').first();
  await prefix.click();
  await prefix.pressSequentially('test-x');
  await prefix.press('Backspace');
  await expect(prefix).toHaveValue('test-');
  await expect(prefix).toBeFocused();
  await prefix.press('ControlOrMeta+a');
  await prefix.pressSequentially('test-');
  await prefix.press('ArrowLeft');
  await prefix.press('ArrowRight');
  await prefix.press('Tab');
  await expect(prefix).not.toBeFocused();
  await expect(prefix).toHaveValue('test-');
  await expect.poll(() => page.evaluate(() => window.siteKeyEvents.length)).toBe(0);

  const typeFilter = page.locator('#type-filter-button');
  await typeFilter.click();
  await expect(typeFilter).toHaveAttribute('aria-expanded', 'true');
  await typeFilter.press('Escape');
  await expect(typeFilter).toHaveAttribute('aria-expanded', 'false');
  await expect(typeFilter).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.siteKeyEvents.length)).toBe(0);
  await expect(page.locator('.button-execute')).toBeEnabled();
  await page.locator('.button-execute').click();
  await expect.poll(() => files.map((file) => file.name), { timeout: 20000 }).toEqual(['test-alpha.txt', 'test-beta.txt']);
  await expect(page.locator('.sync-status.refresh-required')).toBeVisible();
  await expect(page.locator('.sync-status.failed')).toHaveCount(0);
  await expect(page.locator('.sync-retry')).toHaveCount(0);
  await expect(page.locator('[data-role="undo-icon-button"]')).toBeEnabled({ timeout: 10000 });
  await page.locator('[data-role="undo-icon-button"]').click();
  await expect.poll(() => files.map((file) => file.name), { timeout: 20000 }).toEqual(['alpha.txt', 'beta.txt']);
  await page.screenshot({ path: screenshotPath });
  await page.locator('.close-button').click();
  await page.locator('#site-input').press('a');
  await expect.poll(() => page.evaluate(() => window.siteKeyEvents.length)).toBeGreaterThan(0);

  console.log(JSON.stringify({
    passed: errors.length === 0,
    worker: worker.url(),
    loadedFiles: files.length,
    renames: calls.filter((call) => call.method === 'POST' && call.path.endsWith('/ListItemAllFields')).length,
    pagination: calls.some((call) => call.path.endsWith('/children') && call.search.includes('page=2')),
    keyboardIsolation: true,
    manualRefreshNotice: true,
    errors,
    requestCount: calls.length,
    screenshotPath,
  }));
  if (errors.length) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ error: error.message, calls, errors }));
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await context?.close();
    } finally {
      if (profile) await rm(profile, { recursive: true, force: true });
    }
  });
