// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { readReleaseZip, releaseVersion, runStore } from '../../scripts/store-release.js';

const itemId = 'kadpaidccbagkojkdghnkpehkmmbobll';
const chrome = 'https://chromewebstore.googleapis.com';
const chromeItem = `/v2/publishers/mock-publisher/items/${itemId}`;
const edge = 'https://api.addons.microsoftedge.microsoft.com';
const product = '11111111-1111-1111-1111-111111111111';
const uploadId = '22222222-2222-2222-2222-222222222222';
const submitId = '33333333-3333-3333-3333-333333333333';
const edgeSubmit = `${edge}/v1/products/${product}/submissions`;
const edgeUpload = `${edgeSubmit}/draft/package`;
const env = {
  CHROME_ACCESS_TOKEN: 'fake-token',
  CHROME_PUBLISHER_ID: 'mock-publisher',
  EDGE_CLIENT_ID: 'fake-client',
  EDGE_API_KEY: 'fake-key',
  EDGE_PRODUCT_ID: product,
  EDGE_CLEAR: 'true',
};
const tag = 'v2.0.3';
const version = tag.slice(1);
const revision = (state, crxVersion) => ({ state, distributionChannels: [{ crxVersion }] });
const status = (extra = {}) => ({
  itemId,
  publishedItemRevisionStatus: revision('PUBLISHED', '2.0.2'),
  ...extra,
});
const pending = status({ submittedItemRevisionStatus: revision('PENDING_REVIEW', version) });
const readChrome = data => ['GET', `${chrome}${chromeItem}:fetchStatus`, data];
const uploadChrome = data => ['POST', `${chrome}/upload${chromeItem}:upload`, data];
const publishChrome = data => ['POST', `${chrome}${chromeItem}:publish`, data];
const readEdge = (path, id, data) => ['GET', `${path}/operations/${id}`, { id, ...data }];
const acceptedEdge = id => new Response(null, { status: 202, headers: { Location: id } });

function releaseZip(manifestVersion, check) {
  const root = mkdtempSync(join(tmpdir(), 'cdr-store-test-'));
  try {
    const path = join(root, 'release.zip');
    writeFileSync(join(root, 'manifest.json'), JSON.stringify({ version: manifestVersion }));
    execFileSync('zip', ['-q', path, 'manifest.json'], { cwd: root });
    return check(path);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const zip = releaseZip(version, path => readReleaseZip(path, version));

function simulate(store, interactions, options = {}) {
  const messages = [];
  let next = 0;
  // This transport never makes a network request, even if route matching fails.
  const fetcher = vi.fn(async (url, request) => {
    const [method, endpoint, result] = interactions[next++] ?? [];
    expect([request.method, url]).toEqual([method, endpoint]);
    expect(request.redirect).toBe('error');
    if (store === 'chrome') expect(request.headers.Authorization).toBe('Bearer fake-token');
    else
      expect(request.headers).toMatchObject({
        Authorization: 'ApiKey fake-key',
        'X-ClientID': 'fake-client',
      });
    if (request.headers['Content-Type'] === 'application/zip') expect(request.body).toBe(zip);
    if (url.endsWith(':publish')) {
      expect(JSON.parse(request.body)).toEqual({
        publishType: 'STAGED_PUBLISH',
        skipReview: false,
        blockOnWarnings: true,
      });
    }
    if (url === edgeSubmit && request.method === 'POST' && options.notes) {
      expect(request.body.toString()).toBe(
        new URLSearchParams({ notes: options.notes }).toString()
      );
    }
    if (result instanceof Error) throw result;
    return result instanceof Response ? result : Response.json(result);
  });
  const result = runStore({
    store,
    tag,
    mode: 'submit',
    zip,
    env,
    fetcher,
    pause: async () => {},
    report: message => messages.push(message),
    ...options,
  });
  return {
    result,
    messages,
    fetcher,
    done: () => expect(fetcher).toHaveBeenCalledTimes(interactions.length),
  };
}

describe('Release 选择', () => {
  it('匹配标签与 ZIP manifest，拒绝版本不一致', () => {
    expect(releaseVersion(tag, 'submit')).toBe(version);
    expect(zip.length).toBeGreaterThan(0);
    releaseZip('2.0.2', path => {
      expect(() => readReleaseZip(path, version)).toThrow(/与标签不一致/);
    });
  });

  it.each(['v2.0.2', 'v2.0.1', '2.0.3', 'v02.0.3', 'v2.0.3; other', 'v2.0.65536'])(
    '禁止发送无效或旧版本 %s（任何请求之前）',
    async badTag => {
      for (const store of ['chrome', 'edge']) {
        const mock = simulate(store, [], { tag: badTag });
        await expect(mock.result).rejects.toThrow();
        mock.done();
      }
    }
  );
});

describe('Chrome Web Store', () => {
  const uploaded = { itemId, crxVersion: version, uploadState: 'SUCCEEDED' };
  const accepted = { itemId, state: 'PENDING_REVIEW' };

  it('提交同一个 Release ZIP，读到指定版本待审而不是线上旧版', async () => {
    const mock = simulate('chrome', [
      readChrome(status()),
      uploadChrome(uploaded),
      publishChrome(accepted),
      readChrome(status()),
      readChrome(pending),
    ]);
    await mock.result;
    mock.done();
    expect(mock.messages.at(-1)).toContain('2.0.2 (PUBLISHED)；送审版本：2.0.3 (PENDING_REVIEW)');
  });

  it('等待异步上传再提交，支持审核已完成的 staged 状态', async () => {
    const mock = simulate('chrome', [
      readChrome(status()),
      uploadChrome({ itemId, uploadState: 'IN_PROGRESS' }),
      readChrome(status({ lastAsyncUploadState: 'IN_PROGRESS' })),
      readChrome(status({ lastAsyncUploadState: 'SUCCEEDED' })),
      publishChrome(accepted),
      readChrome(status({ submittedItemRevisionStatus: revision('STAGED', version) })),
    ]);
    await mock.result;
    mock.done();
    expect(mock.messages.at(-1)).toContain('2.0.3 (STAGED)');
  });

  it('只读模式可核对 v2.0.2，无需 ZIP', async () => {
    const mock = simulate('chrome', [readChrome(status())], {
      mode: 'status',
      zip: undefined,
      tag: 'v2.0.2',
    });
    await mock.result;
    mock.done();
    expect(mock.messages.at(-1)).toContain('2.0.2 (PUBLISHED)');
  });

  it('相同版本在审核中不写入，其他版本在审也不覆盖', async () => {
    const same = simulate('chrome', [readChrome(pending)]);
    await same.result;
    same.done();
    const other = simulate('chrome', [
      readChrome(status({ submittedItemRevisionStatus: revision('PENDING_REVIEW', '2.0.4') })),
    ]);
    await expect(other.result).rejects.toThrow(/其他版本正在审核/);
    other.done();
  });

  it.each([
    [{ itemId, crxVersion: '2.0.4', uploadState: 'SUCCEEDED' }, /版本不匹配/],
    [{ itemId, uploadState: 'FAILED' }, /未成功/],
  ])('上传未确认目标版本时不提交 (%j)', async (upload, message) => {
    const mock = simulate('chrome', [readChrome(status()), uploadChrome(upload)]);
    await expect(mock.result).rejects.toThrow(message);
    mock.done();
  });

  it.each([true, false])('送审响应丢失只回读、不重发（可确认：%s）', async confirmed => {
    const mock = simulate('chrome', [
      readChrome(status()),
      uploadChrome(uploaded),
      publishChrome(new Error('connection reset')),
      readChrome(confirmed ? pending : status()),
    ]);
    if (confirmed) await mock.result;
    else await expect(mock.result).rejects.toThrow(/未收到响应/);
    mock.done();
  });

  it('提交接口成功但回读为拒绝，报告实际拒绝', async () => {
    const mock = simulate('chrome', [
      readChrome(status()),
      uploadChrome(uploaded),
      publishChrome(accepted),
      readChrome(status({ submittedItemRevisionStatus: revision('REJECTED', version) })),
    ]);
    await expect(mock.result).rejects.toThrow(/未确认目标版本/);
    expect(mock.messages.at(-1)).toContain('2.0.3 (REJECTED)');
    mock.done();
  });
});

describe('Edge Add-ons', () => {
  const upload = ['POST', edgeUpload, acceptedEdge(uploadId)];
  const uploadOK = readEdge(edgeUpload, uploadId, { status: 'Succeeded' });
  const submit = () => ['POST', edgeSubmit, acceptedEdge(`${edgeSubmit}/operations/${submitId}`)];
  const underReview = { status: 'Failed', errorCode: 'InProgressSubmission' };

  it('未确认 Edge 无在审版本和草稿时不调用商店', async () => {
    const mock = simulate('edge', [], { env: { ...env, EDGE_CLEAR: 'false' } });
    await expect(mock.result).rejects.toThrow(/勾选 edge_clear/);
    mock.done();
  });

  it('上传与提交分别按操作 ID 查询，不把受理当成上架', async () => {
    const mock = simulate(
      'edge',
      [
        upload,
        readEdge(edgeUpload, uploadId, { status: 'InProgress' }),
        uploadOK,
        submit(),
        readEdge(edgeSubmit, submitId, { status: 'InProgress' }),
        readEdge(edgeSubmit, submitId, { status: 'Succeeded' }),
      ],
      { notes: '核对 & 撤销' }
    );
    await mock.result;
    mock.done();
    expect(mock.messages.at(-1)).toContain('提交单已创建 (Succeeded)');
    expect(mock.messages.at(-1)).toContain('Partner Center 确认');
  });

  it('上传失败不提交，且不输出原始响应', async () => {
    const mock = simulate('edge', [
      upload,
      readEdge(edgeUpload, uploadId, { status: 'Failed', message: 'private response body' }),
    ]);
    await expect(mock.result).rejects.toThrow(/上传失败 \(Failed\)/);
    mock.done();
    expect(mock.messages.join('\n')).not.toContain('private response body');
  });

  it('已经有在审版本时保留操作 ID，拒绝重复提交', async () => {
    const mock = simulate('edge', [
      upload,
      uploadOK,
      submit(),
      readEdge(edgeSubmit, submitId, underReview),
    ]);
    await expect(mock.result).rejects.toThrow(/已有版本正在审核/);
    mock.done();
    expect(mock.messages.join('\n')).toContain(submitId);
  });

  it('提交已受理但回读未结束，只提示查询操作 ID', async () => {
    const mock = simulate('edge', [
      upload,
      uploadOK,
      submit(),
      ...Array.from({ length: 12 }, () => readEdge(edgeSubmit, submitId, { status: 'InProgress' })),
    ]);
    await expect(mock.result).rejects.toThrow(/状态暂未确定/);
    mock.done();
    expect(mock.messages.join('\n')).toContain(submitId);
  });

  it('状态模式只读原操作；不接受错误 ID', async () => {
    const mock = simulate('edge', [readEdge(edgeSubmit, submitId, { status: 'Succeeded' })], {
      mode: 'status',
      operationId: submitId,
      zip: undefined,
    });
    await mock.result;
    mock.done();
    const invalid = simulate('edge', [], {
      mode: 'status',
      operationId: 'https://other.invalid/fake',
    });
    await expect(invalid.result).rejects.toThrow(/需要原送审操作 ID/);
    invalid.done();
  });
});
