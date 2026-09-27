import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OneDriveAdapter } from '../../../src/adapters/onedrive/adapter';
import { OneDrivePageScriptInjector } from '../../../src/adapters/onedrive/page-script-injector';

const uniqueId = '33333333-3333-3333-3333-333333333333';
const siteId = '11111111-1111-1111-1111-111111111111';
const listId = '22222222-2222-2222-2222-222222222222';

function fileItem(name = 'original.txt') {
  return {
    id: 'hex!item-1',
    name,
    size: 12,
    eTag: '"item-etag"',
    parentReference: { id: 'hex!folder', driveId: 'drive-1' },
    sharepointIds: { siteId, listId, listItemUniqueId: uniqueId },
    file: { mimeType: 'text/plain' },
  };
}

function setLocation(search = '') {
  vi.stubGlobal('window', {
    location: {
      href: `https://onedrive.live.com/my${search}`,
      origin: 'https://onedrive.live.com',
      pathname: '/my',
      search,
    },
  });
}

function directoryResponse(id = 'hex!folder') {
  return {
    item: { id, parentReference: { driveId: 'drive-1' } },
    scopeKey: `/personal/account:${id}`,
    isRoot: false,
    pathLength: 35,
  };
}

function mockListedPages(pages: unknown[][] = [[fileItem()]]) {
  return vi.spyOn(OneDrivePageScriptInjector.prototype, 'call').mockImplementation(async (operation, options = {}) => {
    if (operation === 'directory') return { data: directoryResponse() };
    if (operation === 'children') {
      const pageIndex = options.continuation ? 1 : 0;
      return { data: { value: pages[pageIndex] ?? [] } };
    }
    throw new Error(`Unexpected operation ${operation}`);
  });
}

describe('OneDriveAdapter', () => {
  beforeEach(() => setLocation());
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('reports manual refresh without pretending to automatically sync the website', async () => {
    const call = vi.spyOn(OneDrivePageScriptInjector.prototype, 'call');
    expect(await new OneDriveAdapter().syncAfterRename()).toEqual({
      success: false,
      method: 'manual-refresh',
    });
    expect(call).not.toHaveBeenCalled();
  });

  it('follows validated pagination and rejects repeated continuation links', async () => {
    const mock = vi.spyOn(OneDrivePageScriptInjector.prototype, 'call').mockImplementation(async (operation, options = {}) => {
      if (operation === 'directory') return { data: directoryResponse() };
      if (operation === 'children' && !options.continuation) {
        return { data: { value: [fileItem()], '@odata.nextLink': '/personal/account/_api/v2.0/drive/items/hex!folder/children?$skiptoken=next' } };
      }
      if (operation === 'children') return { data: { value: [{ ...fileItem(), id: 'hex!item-2', sharepointIds: { siteId, listId, listItemUniqueId: '44444444-4444-4444-4444-444444444444' } }] } };
      throw new Error(`Unexpected operation ${operation}`);
    });
    const adapter = new OneDriveAdapter();
    expect(await adapter.getAllFiles()).toHaveLength(2);
    expect(mock.mock.calls.filter(([operation]) => operation === 'children')).toHaveLength(2);

    mock.mockImplementation(async (operation, options = {}) => {
      if (operation === 'directory') return { data: directoryResponse() };
      if (operation === 'children') return { data: { value: [], '@odata.nextLink': options.continuation ?? '/personal/account/_api/v2.0/drive/root/children?$skiptoken=loop' } };
      throw new Error(`Unexpected operation ${operation}`);
    });
    await expect(adapter.getAllFiles()).rejects.toThrow(/repeated continuation/i);
  });

  it('rejects a parent from the old directory after the route changes', async () => {
    mockListedPages();
    const adapter = new OneDriveAdapter();
    const files = await adapter.getAllFiles();
    setLocation('?id=%2Fpersonal%2Faccount%2FDocuments%2FOther');
    vi.spyOn(OneDrivePageScriptInjector.prototype, 'call').mockResolvedValue({ data: directoryResponse('hex!other') });
    await expect(adapter.getAllFiles(files[0].parentId)).rejects.toThrow(/directory changed/i);
  });

  it('keeps the original FileItem intact after a successful rename for undo records', async () => {
    const call = mockListedPages();
    const adapter = new OneDriveAdapter();
    const [file] = await adapter.getAllFiles();
    call.mockImplementation(async (operation) => {
      if (operation === 'rename') return { data: { name: 'renamed.txt' } };
      if (operation === 'item') return { data: fileItem('renamed.txt') };
      throw new Error(`Unexpected operation ${operation}`);
    });
    const result = await adapter.renameFile(file.id, 'renamed.txt');
    expect(result).toMatchObject({ success: true, newName: 'renamed.txt' });
    expect(file.name).toBe('original.txt');
    expect((await adapter.getFileInfo(file.id)).name).toBe('renamed.txt');
  });

  it('allows a case-only rename of the same file while detecting another item collision', async () => {
    const call = mockListedPages();
    const adapter = new OneDriveAdapter();
    const [file] = await adapter.getAllFiles();
    expect(await adapter.checkNameConflict('ORIGINAL.TXT', file.parentId, file.id)).toBe(false);
    expect(await adapter.checkNameConflict('ORIGINAL.TXT', file.parentId)).toBe(true);
    call.mockImplementation(async (operation) => operation === 'rename' ? { data: { name: 'ORIGINAL.TXT' } } : Promise.reject(new Error(`Unexpected operation ${operation}`)));
    expect((await adapter.renameFile(file.id, 'ORIGINAL.TXT')).success).toBe(true);
  });

  it('honors Retry-After and verifies an ambiguous result before any retry', async () => {
    const call = mockListedPages();
    const adapter = new OneDriveAdapter();
    const [file] = await adapter.getAllFiles();
    const sleep = vi.spyOn(adapter as unknown as { sleep: (ms: number) => Promise<void> }, 'sleep').mockResolvedValue(undefined);
    let renameCount = 0;
    call.mockImplementation(async (operation) => {
      if (operation === 'rename') {
        renameCount++;
        if (renameCount === 1) throw Object.assign(new Error('HTTP 429'), { status: 429, headers: { 'retry-after': '0.001' } });
        return { data: { name: 'renamed.txt' } };
      }
      if (operation === 'item') return { data: fileItem() };
      throw new Error(`Unexpected operation ${operation}`);
    });
    expect((await adapter.renameFile(file.id, 'renamed.txt')).success).toBe(true);
    expect(sleep).toHaveBeenCalledWith(1);
    expect(renameCount).toBe(2);

    renameCount = 0;
    call.mockImplementation(async (operation) => {
      if (operation === 'directory') return { data: directoryResponse() };
      if (operation === 'children') return { data: { value: [fileItem('renamed.txt')] } };
      if (operation === 'rename') {
        renameCount++;
        throw new Error('OneDrive API request timeout');
      }
      if (operation === 'item') return { data: fileItem('renamed.txt') };
      throw new Error(`Unexpected operation ${operation}`);
    });
    expect((await adapter.renameFile(file.id, 'second-name.txt')).success).toBe(false);
    expect(renameCount).toBe(1);
  });
});
