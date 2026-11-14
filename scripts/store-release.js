import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const chromeOrigin = 'https://chromewebstore.googleapis.com';
const edgeOrigin = 'https://api.addons.microsoftedge.microsoft.com';
const chromeItem = 'kadpaidccbagkojkdghnkpehkmmbobll';
const chromeStates = new Set([
  'PENDING_REVIEW',
  'STAGED',
  'PUBLISHED',
  'PUBLISHED_TO_TESTERS',
  'REJECTED',
  'CANCELLED',
]);
const activeChromeStates = new Set(['PENDING_REVIEW', 'STAGED']);
const versionPattern = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class ReleaseError extends Error {}

function requireCondition(condition, message) {
  if (!condition) throw new ReleaseError(message);
}

function compareVersions(left, right) {
  const a = left.split('.').map(Number);
  const b = right.split('.').map(Number);
  for (let i = 0; i < 4; i++) {
    const difference = (a[i] ?? 0) - (b[i] ?? 0);
    if (difference) return difference;
  }
  return 0;
}

export function releaseVersion(tag, mode) {
  requireCondition(mode === 'submit' || mode === 'status', '请选择 submit 或 status。');
  const version = tag?.startsWith('v') ? tag.slice(1) : '';
  requireCondition(
    versionPattern.test(version) && version.split('.').every(part => Number(part) <= 65535),
    '请填写 vMAJOR.MINOR.PATCH 格式的 Release 标签。'
  );
  requireCondition(
    mode !== 'submit' || compareVersions(version, '2.0.2') > 0,
    'API 不提交 v2.0.2 或更早版本；它们继续走原有流程。'
  );
  return version;
}

export function readReleaseZip(path, expectedVersion) {
  let manifest;
  try {
    manifest = JSON.parse(
      execFileSync('unzip', ['-p', path, 'manifest.json'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 1024 * 1024,
      })
    );
  } catch {
    throw new ReleaseError('Release ZIP 缺少可读取的根目录 manifest.json。');
  }
  requireCondition(
    manifest?.version === expectedVersion,
    'Release ZIP 的 manifest.version 与标签不一致。'
  );
  return readFileSync(path);
}

function makeClient(fetcher, pause) {
  async function request(
    url,
    { method = 'GET', headers, body, operation, expected = 200, json = true }
  ) {
    let response;
    try {
      response = await fetcher(url, {
        method,
        headers,
        body,
        redirect: 'error',
        signal: AbortSignal.timeout(25_000),
      });
    } catch {
      throw new ReleaseError(`${operation}未收到响应；请先核对商店状态。`);
    }
    requireCondition(
      response.status === expected,
      `${operation}返回 HTTP ${response.status}；请先核对商店状态。`
    );
    if (!json) return response;
    try {
      return await response.json();
    } catch {
      throw new ReleaseError(`${operation}返回的状态无法读取；请先核对商店状态。`);
    }
  }

  async function poll(read, state, pending) {
    for (let i = 0; i < 12; i++) {
      if (i) await pause(5_000);
      const data = await read();
      if (state(data) !== pending) return data;
    }
    throw new ReleaseError('状态暂未确定；请先回读，不要重发写入请求。');
  }

  return { request, poll };
}

function chromeRevision(data, field) {
  const revision = data[field];
  if (revision == null) return null;
  const versions = Array.isArray(revision.distributionChannels)
    ? [...new Set(revision.distributionChannels.map(channel => channel?.crxVersion))]
    : [];
  requireCondition(
    chromeStates.has(revision.state) &&
      versions.length > 0 &&
      versions.every(version => typeof version === 'string' && /^\d+(?:\.\d+){0,3}$/.test(version)),
    'Chrome 返回的修订版本或状态不完整，请到后台核对。'
  );
  return { state: revision.state, versions };
}

function describeRevision(revision) {
  return revision ? `${revision.versions.join('、')} (${revision.state})` : '无';
}

async function runChrome({ mode, version, zip, env, client, report }) {
  requireCondition(env.CHROME_ACCESS_TOKEN, '缺少 Chrome API access token。');
  requireCondition(
    /^[A-Za-z0-9_-]+$/.test(env.CHROME_PUBLISHER_ID ?? ''),
    '缺少有效的 CHROME_PUBLISHER_ID。'
  );
  const resource = `/v2/publishers/${env.CHROME_PUBLISHER_ID}/items/${chromeItem}`;
  const headers = { Authorization: `Bearer ${env.CHROME_ACCESS_TOKEN}` };
  const readStatus = async () => {
    const data = await client.request(`${chromeOrigin}${resource}:fetchStatus`, {
      headers,
      operation: 'Chrome 状态查询',
    });
    requireCondition(data?.itemId === chromeItem, 'Chrome 状态未匹配预期扩展 ID。');
    return data;
  };
  const describe = data => {
    const published = chromeRevision(data, 'publishedItemRevisionStatus');
    const submitted = chromeRevision(data, 'submittedItemRevisionStatus');
    report(
      `Chrome 线上版本：${describeRevision(published)}；送审版本：${describeRevision(submitted)}。`
    );
    return { published, submitted };
  };
  const before = await readStatus();
  const { published, submitted } = describe(before);
  if (mode === 'status') {
    if (!published?.versions.includes(version) && !submitted?.versions.includes(version)) {
      report(`Chrome 未在当前线上或送审修订中找到 ${version}。`);
    }
    return;
  }
  if (
    published?.versions.includes(version) ||
    (submitted?.versions.includes(version) && activeChromeStates.has(submitted.state))
  ) {
    report(`Chrome ${version} 已在线上、审核中或待发布，未重复提交。`);
    return;
  }
  requireCondition(
    !activeChromeStates.has(submitted?.state),
    'Chrome 有其他版本正在审核或待发布，本次未上传。'
  );
  requireCondition(
    !submitted?.versions.includes(version),
    'Chrome 已有本版本的历史提交，请到后台核对，本次未上传。'
  );
  requireCondition(
    before.lastAsyncUploadState !== 'IN_PROGRESS',
    'Chrome 有尚未完成的上传，本次未上传。'
  );
  requireCondition(
    !before.takenDown && !before.warned,
    'Chrome 条目有政策告警或已下架，请先检查后台。'
  );
  requireCondition(
    !published?.versions.some(other => compareVersions(other, version) >= 0),
    'Chrome 线上已有不低于目标的版本，本次未上传。'
  );

  const uploaded = await client.request(`${chromeOrigin}/upload${resource}:upload`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/zip' },
    body: zip,
    operation: 'Chrome 上传',
  });
  requireCondition(uploaded?.itemId === chromeItem, 'Chrome 上传结果未匹配扩展 ID，未提交审核。');
  if (uploaded.uploadState === 'IN_PROGRESS') {
    const done = await client.poll(readStatus, data => data.lastAsyncUploadState, 'IN_PROGRESS');
    requireCondition(
      done.lastAsyncUploadState === 'SUCCEEDED',
      'Chrome 异步上传未成功，未提交审核。'
    );
  } else {
    requireCondition(
      uploaded.uploadState === 'SUCCEEDED' && uploaded.crxVersion === version,
      'Chrome 上传未成功或版本不匹配，未提交审核。'
    );
  }
  report(`Chrome ${version} 上传完成。`);

  // POST 只发一次。即使确认响应丢失，也先使用 GET 对照这次的目标版本。
  let submitError;
  try {
    const accepted = await client.request(`${chromeOrigin}${resource}:publish`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publishType: 'STAGED_PUBLISH',
        skipReview: false,
        blockOnWarnings: true,
      }),
      operation: 'Chrome 提交审核',
    });
    requireCondition(accepted?.itemId === chromeItem, 'Chrome 提交响应未匹配扩展 ID。');
  } catch (error) {
    submitError = error;
  }
  // 提交失败仍回读一次；正常路径允许状态写入有短时延迟。
  const after = await client.poll(
    readStatus,
    data => {
      const sent = chromeRevision(data, 'submittedItemRevisionStatus');
      const live = chromeRevision(data, 'publishedItemRevisionStatus');
      return sent?.versions.includes(version) || live?.versions.includes(version)
        ? 'matched'
        : 'unmatched';
    },
    submitError ? null : 'unmatched'
  );
  const actual = describe(after);
  const confirmed =
    actual.published?.versions.includes(version) ||
    (actual.submitted?.versions.includes(version) &&
      activeChromeStates.has(actual.submitted.state));
  requireCondition(
    confirmed,
    submitError?.message ?? 'Chrome 未确认目标版本进入待审或待发布，请检查后台。'
  );
}

function edgeOperationId(response, operation) {
  const id = response.headers.get('location')?.trim().split('/').at(-1);
  requireCondition(
    guidPattern.test(id ?? ''),
    `${operation}已受理，但未返回可用操作 ID；请核对 Partner Center。`
  );
  return id;
}

async function runEdge({ mode, version, zip, env, client, operationId, notes, report }) {
  requireCondition(env.EDGE_CLIENT_ID && env.EDGE_API_KEY, '缺少 EDGE_CLIENT_ID 或 EDGE_API_KEY。');
  requireCondition(
    guidPattern.test(env.EDGE_PRODUCT_ID ?? ''),
    'EDGE_PRODUCT_ID 必须是 Partner Center 的产品 GUID。'
  );
  const resource = `${edgeOrigin}/v1/products/${env.EDGE_PRODUCT_ID}/submissions`;
  const headers = { Authorization: `ApiKey ${env.EDGE_API_KEY}`, 'X-ClientID': env.EDGE_CLIENT_ID };
  const check = async (path, id, operation) => {
    report(`${operation}操作 ID：${id}。`);
    const result = await client.poll(
      () => client.request(`${path}/operations/${id}`, { headers, operation }),
      data => data?.status,
      'InProgress'
    );
    requireCondition(
      typeof result?.id === 'string' && result.id.toLowerCase() === id.toLowerCase(),
      `${operation}回读未匹配操作 ID。`
    );
    if (result.status === 'Failed') {
      if (result.errorCode === 'InProgressSubmission') {
        throw new ReleaseError('Edge 已有版本正在审核，请在 Partner Center 核对，不要重发。');
      }
      throw new ReleaseError(`${operation}失败 (Failed)，请在 Partner Center 核对该操作。`);
    }
    requireCondition(
      result.status === 'Succeeded',
      `${operation}返回未确认状态，请在 Partner Center 核对。`
    );
  };
  if (mode === 'submit') {
    const upload = await client.request(`${resource}/draft/package`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/zip' },
      body: zip,
      operation: 'Edge 上传',
      expected: 202,
      json: false,
    });
    await check(`${resource}/draft/package`, edgeOperationId(upload, 'Edge 上传'), 'Edge 上传');
    report(`Edge ${version} 上传完成。`);
    const submitted = await client.request(resource, {
      method: 'POST',
      headers,
      body: notes ? new URLSearchParams({ notes }) : undefined,
      operation: 'Edge 提交审核',
      expected: 202,
      json: false,
    });
    operationId = edgeOperationId(submitted, 'Edge 提交审核');
  }
  requireCondition(
    guidPattern.test(operationId ?? ''),
    'Edge 状态查询需要原送审操作 ID（edge_operation_id）。'
  );
  await check(resource, operationId, 'Edge 提交审核');
  const label = mode === 'submit' ? version : `查询标签 v${version}（以操作 ID 为准）`;
  report(`Edge ${label}：提交单已创建 (Succeeded)。审核与上架状态请在 Partner Center 确认。`);
}

export async function runStore({
  store,
  tag,
  mode,
  zip,
  env,
  operationId,
  notes,
  fetcher = globalThis.fetch,
  pause = sleep,
  report = console.log,
}) {
  const version = releaseVersion(tag, mode);
  requireCondition(store === 'chrome' || store === 'edge', '请选择有效的目标商店。');
  requireCondition(mode !== 'submit' || zip?.length > 0, '送审需要已验证的 Release ZIP。');
  requireCondition(
    store !== 'edge' || mode !== 'submit' || env.EDGE_CLEAR === 'true',
    'Edge 未发送请求：请在 Partner Center 核对无待审版本或未处理草稿，再勾选 edge_clear。'
  );
  const client = makeClient(fetcher, pause);
  const run = store === 'chrome' ? runChrome : runEdge;
  await run({ mode, version, zip, env, client, report, operationId, notes });
}

async function main() {
  const [command, tag, mode, file] = process.argv.slice(2);
  const report = message => {
    console.log(message);
    if (process.env.GITHUB_STEP_SUMMARY)
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, `- ${message}\n`);
  };
  try {
    const version = releaseVersion(tag, mode);
    if (command === 'validate') {
      if (file) readReleaseZip(file, version);
      return;
    }
    await runStore({
      store: command,
      tag,
      mode,
      zip: mode === 'submit' ? readReleaseZip(file, version) : undefined,
      env: process.env,
      operationId: process.env.EDGE_OPERATION_ID,
      notes: process.env.EDGE_NOTES,
      report,
    });
  } catch (error) {
    report(
      error instanceof ReleaseError
        ? error.message
        : '工作流遇到本地执行错误，请检查配置和 Release 文件。'
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
