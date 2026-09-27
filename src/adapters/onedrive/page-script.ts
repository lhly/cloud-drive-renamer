type Operation = 'directory' | 'children' | 'item' | 'rename';
type BridgeRequest = {
  type: 'ONEDRIVE_API_REQUEST';
  requestId: string;
  operation: Operation;
  itemId?: string;
  continuation?: string;
  expectedOldName?: string;
  newName?: string;
  expectedParentId?: string;
  deadline?: number;
};
type PageContext = { webAbsoluteUrl?: unknown; listUrl?: unknown };

const REQUEST_TYPE = 'ONEDRIVE_API_REQUEST';
const RESPONSE_TYPE = 'ONEDRIVE_API_RESPONSE';
const READY_FLAG = '__ONEDRIVE_PAGE_SCRIPT_READY__';
const API_PREFIX = '/_api/v2.0/';
const SELECT = 'id,name,sharepointIds,parentReference,file,folder,remoteItem,specialFolder,eTag,size,lastModifiedDateTime';
const stableToDriveItem = new Map<string, string>();
const digestCache = new Map<string, { value: string; expiresAt: number }>();

function getSiteBase(): URL {
  if (window.location.pathname !== '/my' && window.location.pathname !== '/my/') throw new Error('This OneDrive view is not supported');
  const params = new URLSearchParams(window.location.search);
  if (params.getAll('id').length > 1 || params.getAll('viewid').length > 1) throw new Error('This OneDrive view is not supported');
  params.forEach((_value, key) => { if (key !== 'id' && key !== 'viewid') throw new Error('This OneDrive view is not supported'); });
  const raw = (window as unknown as { _spPageContextInfo?: PageContext })._spPageContextInfo?.webAbsoluteUrl;
  if (typeof raw !== 'string') throw new Error('OneDrive page context is unavailable');
  const base = new URL(raw, window.location.origin);
  if (base.origin !== window.location.origin || base.hostname !== 'onedrive.live.com' || !base.pathname.startsWith('/personal/')) {
    throw new Error('OneDrive page context is outside the supported personal site');
  }
  return base;
}

function apiUrl(base: URL, path: string): URL {
  return new URL(`${base.href.replace(/\/$/, '')}/${path.replace(/^\//, '')}`);
}

function safeItemId(value: unknown): string {
  if (typeof value !== 'string' || !/^[\w!.-]+$/.test(value)) throw new Error('Invalid OneDrive item identifier');
  return encodeURIComponent(value);
}

function itemUrl(base: URL, itemId: string): URL {
  return apiUrl(base, `${API_PREFIX}drive/items/${safeItemId(itemId)}?$select=${SELECT}`);
}

function childrenUrl(base: URL, itemId?: string): URL {
  const path = itemId ? `drive/items/${safeItemId(itemId)}/children` : 'drive/root/children';
  return apiUrl(base, `${API_PREFIX}${path}?$select=${SELECT}`);
}

function resolveCurrentDirectory(base: URL): URL {
  const params = new URLSearchParams(window.location.search);
  if (params.getAll('id').length > 1 || params.getAll('viewid').length > 1) throw new Error('This OneDrive view is not supported');
  params.forEach((_value, key) => { if (key !== 'id' && key !== 'viewid') throw new Error('This OneDrive view is not supported'); });
  const rawListUrl = (window as unknown as { _spPageContextInfo?: PageContext })._spPageContextInfo?.listUrl;
  if (typeof rawListUrl !== 'string' || !rawListUrl.startsWith('/personal/')) throw new Error('OneDrive document library context is unavailable');
  const requested = params.get('id');
  const listPath = rawListUrl.replace(/\/$/, '');
  if (params.has('id') && !requested) throw new Error('Invalid OneDrive directory path');
  const normalizedRequested = requested?.replace(/\/$/, '');
  if (!normalizedRequested || normalizedRequested === listPath) return apiUrl(base, `${API_PREFIX}drive/root?$select=${SELECT}`);
  if (!normalizedRequested.startsWith(`${listPath}/`) || normalizedRequested.includes('\\')) throw new Error('This OneDrive directory is outside My files');
  const relative = normalizedRequested.slice(listPath.length + 1);
  const segments = relative.split('/');
  if (!relative || segments.some((part) => !part || part === '.' || part === '..')) throw new Error('Invalid OneDrive directory path');
  const encoded = segments.map((part) => encodeURIComponent(part)).join('/');
  return apiUrl(base, `${API_PREFIX}drive/root:/${encoded}?$select=${SELECT}`);
}

async function fetchResponse(url: URL, method = 'GET', headers: Record<string, string> = {}, body?: string, deadline = Date.now() + 30000): Promise<{ data: unknown; status: number; headers: Record<string, string> }> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new Error('OneDrive API request deadline exceeded');
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), Math.min(30000, remaining));
  let response: Response;
  let bodyText: string;
  try {
    response = await fetch(url.href, {
      method,
      credentials: 'include',
      headers: { Accept: 'application/json;odata=nometadata', ...headers },
      body,
      signal: controller.signal,
    });
    bodyText = await response.text();
  } catch (error) {
    if (controller.signal.aborted) throw new Error('OneDrive API request timeout');
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
  const responseHeaders: Record<string, string> = {};
  for (const name of ['retry-after', 'etag', 'content-type']) {
    const value = response.headers.get(name);
    if (value) responseHeaders[name] = value;
  }
  let data: unknown;
  try { data = bodyText ? JSON.parse(bodyText) : null; } catch { data = bodyText; }
  if (!response.ok) {
    const message = typeof data === 'object' && data && 'error' in data
      ? JSON.stringify((data as { error: unknown }).error)
      : `HTTP ${response.status}`;
    throw Object.assign(new Error(message), { status: response.status, headers: responseHeaders });
  }
  return { data, status: response.status, headers: responseHeaders };
}

function rememberItems(payload: unknown): void {
  if (!payload || typeof payload !== 'object') return;
  const entries = (payload as { value?: unknown }).value;
  const items = Array.isArray(entries) ? entries : [payload];
  for (const value of items) {
    const item = value as { id?: unknown; sharepointIds?: { siteId?: unknown; listId?: unknown; listItemUniqueId?: unknown } };
    const sp = item?.sharepointIds;
    if (typeof item?.id === 'string' && typeof sp?.siteId === 'string' && typeof sp.listId === 'string' && typeof sp.listItemUniqueId === 'string') {
      stableToDriveItem.set(`${sp.siteId}:${sp.listId}:${sp.listItemUniqueId.toLowerCase()}`, item.id);
    }
  }
}

function parseStableId(id: string): { siteId: string; listId: string; uniqueId: string } {
  const parts = id.split(':');
  if (parts.length !== 3 || !/^[0-9a-f-]{36}$/i.test(parts[0]) || !/^[0-9a-f-]{36}$/i.test(parts[1]) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parts[2])) {
    throw new Error('Invalid OneDrive stable file identifier');
  }
  return { siteId: parts[0], listId: parts[1], uniqueId: parts[2] };
}

async function getDigest(base: URL, deadline: number): Promise<string> {
  const key = base.href;
  const cached = digestCache.get(key);
  if (cached && cached.expiresAt > Date.now() + 30000) return cached.value;
  const result = await fetchResponse(apiUrl(base, '_api/contextinfo'), 'POST', {}, undefined, deadline);
  const info = result.data as { FormDigestValue?: unknown; FormDigestTimeoutSeconds?: unknown };
  if (typeof info?.FormDigestValue !== 'string' || !info.FormDigestValue) throw new Error('OneDrive did not return a request digest');
  const ttl = info.FormDigestTimeoutSeconds;
  if (typeof ttl !== 'number' || !Number.isFinite(ttl) || ttl <= 0) throw new Error('OneDrive returned an invalid request digest lifetime');
  digestCache.set(key, { value: info.FormDigestValue, expiresAt: Date.now() + ttl * 1000 });
  return digestCache.get(key)!.value;
}

async function rename(request: BridgeRequest, base: URL, deadline: number): Promise<{ data: unknown; status: number; headers: Record<string, string> }> {
  if (typeof request.itemId !== 'string' || typeof request.expectedOldName !== 'string' || typeof request.newName !== 'string') throw new Error('Invalid OneDrive rename request');
  validateRenameName(request.newName);
  const identity = parseStableId(request.itemId);
  const driveItemId = stableToDriveItem.get(request.itemId);
  if (!driveItemId) throw new Error('OneDrive item details are unavailable; reload the directory');
  const itemResult = await fetchResponse(itemUrl(base, driveItemId), 'GET', {}, undefined, deadline);
  const item = itemResult.data as { name?: unknown; file?: unknown; remoteItem?: unknown; sharepointIds?: { siteId?: unknown; listId?: unknown; listItemUniqueId?: unknown }; parentReference?: { id?: unknown; driveId?: unknown } };
  const currentDirectory = (await fetchResponse(resolveCurrentDirectory(base), 'GET', {}, undefined, deadline)).data as { id?: unknown; parentReference?: { driveId?: unknown } };
  if (!item || item.name !== request.expectedOldName || !item.file || item.remoteItem !== undefined ||
      item.sharepointIds?.siteId !== identity.siteId || item.sharepointIds?.listId !== identity.listId ||
      item.sharepointIds?.listItemUniqueId?.toString().toLowerCase() !== identity.uniqueId.toLowerCase() ||
      item.parentReference?.id !== currentDirectory.id || item.parentReference?.id !== request.expectedParentId?.split(':').slice(1).join(':') ||
      (currentDirectory.parentReference?.driveId && item.parentReference?.driveId !== currentDirectory.parentReference.driveId)) {
    throw new Error('OneDrive file changed since it was listed; reload the directory before renaming');
  }
  const rawListUrl = (window as unknown as { _spPageContextInfo?: PageContext })._spPageContextInfo?.listUrl;
  if (typeof rawListUrl !== 'string') throw new Error('OneDrive document library context is unavailable');
  const searchPath = new URLSearchParams(window.location.search).get('id') || rawListUrl;
  if (Array.from(searchPath).length + 1 + Array.from(request.newName).length > 400) throw new Error('The complete OneDrive path is too long');
  await assertNoNameCollision(base, item.parentReference?.id as string, identity.uniqueId, request.newName, deadline);
  const listItemUrl = apiUrl(base, `_api/web/GetFileById('${identity.uniqueId}')/ListItemAllFields`);
  const listItemReadUrl = apiUrl(base, `_api/web/GetFileById('${identity.uniqueId}')/ListItemAllFields?$select=FileLeafRef,FileDirRef`);
  const listItemResponse = await fetchResponse(listItemReadUrl, 'GET', { Accept: 'application/json;odata=verbose' }, undefined, deadline);
  const listItem = listItemResponse.data as { d?: { __metadata?: { type?: unknown; etag?: unknown }; FileLeafRef?: unknown; FileDirRef?: unknown } };
  const entityType = listItem?.d?.__metadata?.type;
  const etag = listItem?.d?.__metadata?.etag;
  if (typeof entityType !== 'string' || typeof etag !== 'string' || !etag) throw new Error('OneDrive file version metadata is unavailable');
  if (listItem.d?.FileLeafRef !== request.expectedOldName || listItem.d?.FileDirRef !== searchPath) {
    throw new Error('OneDrive file changed or moved since it was listed; reload the directory before renaming');
  }
  const digest = await getDigest(base, deadline);
  const mergeHeaders = {
    Accept: 'application/json;odata=nometadata',
    'Content-Type': 'application/json;odata=verbose',
    'X-HTTP-Method': 'MERGE',
    'If-Match': etag,
    'X-RequestDigest': digest,
  };
  const mergeBody = JSON.stringify({ __metadata: { type: entityType }, FileLeafRef: request.newName });
  if (Date.now() >= deadline) throw new Error('OneDrive API request deadline exceeded before rename');
  try {
    await fetchResponse(listItemUrl, 'POST', mergeHeaders, mergeBody, deadline);
  } catch (error) {
    const failure = error as Error & { status?: number };
    if (failure.status !== 403 || !/digest|security validation/i.test(failure.message)) throw error;
    digestCache.delete(base.href);
    mergeHeaders['X-RequestDigest'] = await getDigest(base, deadline);
    if (Date.now() >= deadline) throw new Error('OneDrive API request deadline exceeded before rename');
    await fetchResponse(listItemUrl, 'POST', mergeHeaders, mergeBody, deadline);
  }
  const verify = await fetchResponse(apiUrl(base, `_api/web/GetFileById('${identity.uniqueId}')?$select=Name,UniqueId`), 'GET', {}, undefined, deadline);
  const verified = verify.data as { Name?: unknown; UniqueId?: unknown };
  if (verified?.Name !== request.newName || verified?.UniqueId?.toString().toLowerCase() !== identity.uniqueId.toLowerCase()) {
    throw new Error('OneDrive rename could not be verified; reload the directory to check the file');
  }
  return { data: { name: verified.Name, id: request.itemId }, status: 200, headers: verify.headers };
}

function validateRenameName(name: string): void {
  const lower = name.toLowerCase();
  const stem = lower.split('.')[0];
  if (!name || !name.trim() || name !== name.trim() || /[\\/:*?"<>|]/.test(name) || /[. ]$/.test(name)) throw new Error('Invalid OneDrive file name');
  if (Array.from(name).length > 255) throw new Error('OneDrive file name is too long');
  if (/^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/.test(stem) || lower === 'desktop.ini' || lower === '.lock' || lower.startsWith('~$') || lower.includes('_vti_')) {
    throw new Error('This name is reserved by OneDrive');
  }
}

async function assertNoNameCollision(base: URL, parentId: string, ownGuid: string, newName: string, deadline: number): Promise<void> {
  let url = childrenUrl(base, parentId);
  const seen = new Set<string>();
  const target = newName.normalize('NFC').toLocaleLowerCase('en-US');
  let hasMore = true;
  while (hasMore) {
    const href = url.href;
    if (seen.has(href)) throw new Error('OneDrive returned a repeated continuation link');
    seen.add(href);
    const response = await fetchResponse(url, 'GET', {}, undefined, deadline);
    const page = response.data as { value?: Array<{ name?: unknown; sharepointIds?: { listItemUniqueId?: unknown } }>; '@odata.nextLink'?: unknown };
    if (!Array.isArray(page?.value)) throw new Error('OneDrive returned an invalid directory listing');
    const hasCollision = page.value.some((entry) => {
      if (typeof entry.name !== 'string' || entry.name.normalize('NFC').toLocaleLowerCase('en-US') !== target) return false;
      const id = entry.sharepointIds?.listItemUniqueId;
      return typeof id !== 'string' || id.toLowerCase() !== ownGuid.toLowerCase();
    });
    if (hasCollision) throw new Error('A file or folder with that name already exists in this OneDrive directory');
    if (typeof page['@odata.nextLink'] !== 'string') {
      hasMore = false;
      continue;
    }
    url = new URL(page['@odata.nextLink'], base.origin);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname.replace(/\/$/, '') + API_PREFIX)) throw new Error('OneDrive continuation is outside the current personal site');
  }
}

async function perform(request: BridgeRequest): Promise<{ data: unknown; status: number; headers: Record<string, string> }> {
  const base = getSiteBase();
  const suppliedDeadline = typeof request.deadline === 'number' && Number.isFinite(request.deadline) ? request.deadline : Date.now() + 30000;
  const deadline = Math.min(suppliedDeadline, Date.now() + 30000);
  if (request.operation === 'rename') return rename(request, base, deadline);
  let url: URL;
  if (request.operation === 'directory') url = resolveCurrentDirectory(base);
  else if (request.continuation !== undefined) {
    url = new URL(request.continuation, base.origin);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname.replace(/\/$/, '') + API_PREFIX)) throw new Error('OneDrive continuation is outside the current personal site');
  } else if (request.operation === 'children') url = childrenUrl(base, request.itemId);
  else if (request.operation === 'item') {
    if (typeof request.itemId !== 'string') throw new Error('Invalid OneDrive item identifier');
    url = itemUrl(base, request.itemId);
  } else throw new Error('Unsupported OneDrive page operation');
  const result = await fetchResponse(url, 'GET', {}, undefined, deadline);
  rememberItems(result.data);
  if (request.operation === 'directory' && result.data && typeof result.data === 'object') {
    const folder = result.data as { id?: unknown };
    if (typeof folder.id === 'string') {
      const requestedId = new URLSearchParams(window.location.search).get('id');
      const rawListUrl = (window as unknown as { _spPageContextInfo?: PageContext })._spPageContextInfo?.listUrl;
      const isRoot = typeof rawListUrl === 'string' && (!requestedId || requestedId === rawListUrl);
      if (typeof rawListUrl !== 'string') throw new Error('OneDrive document library context is unavailable');
      const path = new URLSearchParams(window.location.search).get('id') || rawListUrl;
      return { ...result, data: { item: result.data, scopeKey: `${base.pathname}:${folder.id}`, isRoot, pathLength: Array.from(path).length } };
    }
  }
  return result;
}

window.addEventListener('message', async (event: MessageEvent<BridgeRequest>) => {
  if (event.source !== window || event.origin !== window.location.origin) return;
  const request = event.data;
  if (!request || request.type !== REQUEST_TYPE || typeof request.requestId !== 'string') return;
  try {
    const result = await perform(request);
    window.postMessage({ type: RESPONSE_TYPE, requestId: request.requestId, success: true, ...result }, window.location.origin);
  } catch (error) {
    const structured = error as Error & { status?: number; headers?: Record<string, string> };
    window.postMessage({ type: RESPONSE_TYPE, requestId: request.requestId, success: false, error: structured.message, status: structured.status, headers: structured.headers }, window.location.origin);
  }
});

(window as unknown as Record<string, unknown>)[READY_FLAG] = { ready: true, timestamp: Date.now() };
if (document.body) document.body.dataset.onedrivePageScriptReady = 'true';
else document.addEventListener('DOMContentLoaded', () => { if (document.body) document.body.dataset.onedrivePageScriptReady = 'true'; }, { once: true });
