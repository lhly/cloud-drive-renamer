import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { Drive115Adapter } from '../../../src/adapters/115/adapter';
import { Drive123Adapter } from '../../../src/adapters/123/adapter';
import { CMCCAdapter, md5 } from '../../../src/adapters/cmcc/adapter';
import { EsurfingAdapter } from '../../../src/adapters/esurfing/adapter';
import { getDrive115PageScriptInjector } from '../../../src/adapters/115/page-script-injector';
import { getDrive123PageScriptInjector } from '../../../src/adapters/123/page-script-injector';
import { getCMCCPageScriptInjector } from '../../../src/adapters/cmcc/page-script-injector';
import { getEsurfingPageScriptInjector } from '../../../src/adapters/esurfing/page-script-injector';

vi.mock('../../../src/adapters/115/page-script-injector', () => ({
  getDrive115PageScriptInjector: vi.fn(),
}));

vi.mock('../../../src/adapters/123/page-script-injector', () => ({
  getDrive123PageScriptInjector: vi.fn(),
}));

vi.mock('../../../src/adapters/cmcc/page-script-injector', () => ({
  getCMCCPageScriptInjector: vi.fn(),
}));

vi.mock('../../../src/adapters/esurfing/page-script-injector', () => ({
  getEsurfingPageScriptInjector: vi.fn(),
}));

describe('missing platform adapters', () => {
  let mock115CallAPI: Mock;
  let mock123CallAPI: Mock;
  let mockCMCCCallAPI: Mock;
  let mockEsurfingCallAPI: Mock;

  beforeEach(() => {
    mock115CallAPI = vi.fn();
    mock123CallAPI = vi.fn();
    mockCMCCCallAPI = vi.fn();
    mockEsurfingCallAPI = vi.fn();

    vi.mocked(getDrive115PageScriptInjector).mockReturnValue({ callAPI: mock115CallAPI });
    vi.mocked(getDrive123PageScriptInjector).mockReturnValue({ callAPI: mock123CallAPI });
    vi.mocked(getCMCCPageScriptInjector).mockReturnValue({ callAPI: mockCMCCCallAPI });
    vi.mocked(getEsurfingPageScriptInjector).mockReturnValue({ callAPI: mockEsurfingCallAPI });

    Object.defineProperty(window, 'location', {
      value: {
        href: 'https://115.com/storage/netdisk?mode=wangpan&cid=folder115',
        search: '?mode=wangpan&cid=folder115',
        pathname: '/storage/netdisk',
        hash: '',
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('uses 115 APIs for listing and batch rename', async () => {
    const adapter = new Drive115Adapter({ requestInterval: 0 });
    mock115CallAPI
      .mockResolvedValueOnce({
        state: true,
        count: 1,
        data: [{ fid: 'file-115', cid: 'folder115', n: 'Episode 01.mkv', size: 12, upt: 123 }],
      })
      .mockResolvedValueOnce({ state: true });

    const files = await adapter.getAllFiles();
    const rename = await adapter.renameFile('file-115', 'Episode 01-fixed.mkv');

    expect(files).toEqual([
      { id: 'file-115', name: 'Episode 01.mkv', ext: '.mkv', parentId: 'folder115', size: 12, mtime: 123 },
    ]);
    expect(rename).toEqual({ success: true, newName: 'Episode 01-fixed.mkv' });
    expect(mock115CallAPI).toHaveBeenNthCalledWith(
      1,
      'GET',
      expect.stringContaining('https://webapi.115.com/files'),
      undefined,
      30000
    );
    expect(mock115CallAPI.mock.calls[0][1]).toContain('cid=folder115');
    expect(mock115CallAPI).toHaveBeenNthCalledWith(
      2,
      'POST',
      'https://webapi.115.com/files/batch_rename',
      {
        bodyMode: 'form-data',
        entries: [
          ['files_new_name[file-115]', 'Episode 01-fixed.mkv'],
          ['format', 'json'],
        ],
      },
      30000
    );
  });

  it('uses 123Pan APIs for listing and rename', async () => {
    const adapter = new Drive123Adapter({ requestInterval: 0 });
    Object.defineProperty(window, 'location', {
      value: { search: '?homeFilePath=0,folder123', pathname: '/', hash: '' },
      writable: true,
      configurable: true,
    });

    mock123CallAPI
      .mockResolvedValueOnce({
        data: {
          InfoList: [{ FileId: 'file-123', FileName: 'Episode 01.mkv', ParentFileId: 'folder123', Size: 34, UpdateAt: 456, type: 0 }],
          Next: '-1',
          Total: 1,
          Len: 1,
        },
      })
      .mockResolvedValueOnce({ code: 0, message: 'success' });

    const files = await adapter.getAllFiles();
    const rename = await adapter.renameFile('file-123', 'Episode 01-fixed.mkv');

    expect(files[0]).toEqual({ id: 'file-123', name: 'Episode 01.mkv', ext: '.mkv', parentId: 'folder123', size: 34, mtime: 456 });
    expect(rename).toEqual({ success: true, newName: 'Episode 01-fixed.mkv' });
    expect(mock123CallAPI.mock.calls[0][1]).toContain('https://www.123pan.com/b/api/file/list/new');
    expect(mock123CallAPI.mock.calls[0][1]).toContain('parentFileId=folder123');
    expect(mock123CallAPI).toHaveBeenNthCalledWith(
      2,
      'POST',
      'https://www.123pan.com/b/api/file/rename',
      expect.objectContaining({ fileId: 'file-123', fileName: 'Episode 01-fixed.mkv', duplicate: 1 }),
      30000
    );
  });

  it('uses CMCC APIs and deduplicates concurrent conflict checks', async () => {
    const adapter = new CMCCAdapter({ requestInterval: 0 });
    Object.defineProperty(window, 'location', {
      value: { search: '', pathname: '/w/', hash: '#/main' },
      writable: true,
      configurable: true,
    });
    localStorage.setItem('currentCatalogID', 'folder139');

    mockCMCCCallAPI.mockResolvedValue({
      data: {
        items: [{ fileId: 'file-139', name: 'Episode 01.mkv', parentFileId: 'folder139', fileExtension: 'mkv', size: 56, updatedAt: 789, type: 'file' }],
        nextPageCursor: null,
      },
    });

    const results = await Promise.all([
      adapter.checkNameConflict('Episode 01.mkv', 'folder139'),
      adapter.checkNameConflict('Episode 02.mkv', 'folder139'),
      adapter.checkNameConflict('Episode 03.mkv', 'folder139'),
    ]);

    expect(results).toEqual([true, false, false]);
    expect(mockCMCCCallAPI).toHaveBeenCalledTimes(1);
    expect(mockCMCCCallAPI.mock.calls[0][1]).toBe('https://personal-kd-njs.yun.139.com/hcy/file/list');
  });

  it('uses Esurfing APIs for listing and form-encoded rename', async () => {
    const adapter = new EsurfingAdapter({ requestInterval: 0 });
    Object.defineProperty(window, 'location', {
      value: { href: 'https://cloud.189.cn/web/main/file/folder/folder189', search: '', pathname: '/web/main/file/folder/folder189', hash: '' },
      writable: true,
      configurable: true,
    });

    mockEsurfingCallAPI
      .mockResolvedValueOnce({
        fileListAO: {
          fileList: [{ id: 'file-189', name: 'Episode 01.mkv', size: 78, lastOpTime: 987 }],
        },
      })
      .mockResolvedValueOnce({ res_code: 0 });

    const files = await adapter.getAllFiles();
    const rename = await adapter.renameFile('file-189', 'Episode 01-fixed.mkv');

    expect(files[0]).toEqual({ id: 'file-189', name: 'Episode 01.mkv', ext: '.mkv', parentId: 'folder189', size: 78, mtime: 987 });
    expect(rename).toEqual({ success: true, newName: 'Episode 01-fixed.mkv' });
    expect(mockEsurfingCallAPI.mock.calls[0][1]).toContain('https://cloud.189.cn/api/open/file/listFiles.action');
    expect(mockEsurfingCallAPI.mock.calls[0][1]).toContain('folderId=folder189');
    expect(mockEsurfingCallAPI).toHaveBeenNthCalledWith(
      2,
      'POST',
      'https://cloud.189.cn/api/open/file/renameFile.action',
      {
        bodyMode: 'urlencoded',
        entries: [['fileId', 'file-189'], ['destFileName', 'Episode 01-fixed.mkv']],
        headers: { Accept: 'application/json;charset=UTF-8' },
      },
      30000
    );
    expect(mockEsurfingCallAPI.mock.calls[0][2]).toEqual({
      bodyMode: 'headers',
      headers: {
        Accept: 'application/json;charset=UTF-8',
        'sign-type': '1',
      },
    });
  });

  it('throws instead of returning an empty list when 123Pan list API fails', async () => {
    const adapter = new Drive123Adapter({ requestInterval: 0 });
    Object.defineProperty(window, 'location', {
      value: { search: '?homeFilePath=0,folder123', pathname: '/', hash: '' },
      writable: true,
      configurable: true,
    });
    mock123CallAPI.mockResolvedValue({ code: 500, message: 'list failed' });

    await expect(adapter.getAllFiles()).rejects.toThrow('list failed');
  });

  it('throws instead of returning an empty list when CMCC list API fails', async () => {
    const adapter = new CMCCAdapter({ requestInterval: 0 });
    localStorage.setItem('currentCatalogID', 'folder139');
    mockCMCCCallAPI.mockResolvedValue({ code: 500, message: 'list failed' });

    await expect(adapter.getAllFiles()).rejects.toThrow('list failed');
  });

  it('throws instead of returning an empty list when Esurfing list API fails', async () => {
    const adapter = new EsurfingAdapter({ requestInterval: 0 });
    Object.defineProperty(window, 'location', {
      value: { href: 'https://cloud.189.cn/web/main/file/folder/folder189', search: '', pathname: '/web/main/file/folder/folder189', hash: '' },
      writable: true,
      configurable: true,
    });
    mockEsurfingCallAPI.mockResolvedValue({ res_code: 401, res_message: 'list failed' });

    await expect(adapter.getAllFiles()).rejects.toThrow('list failed');
  });

  it('keeps CMCC MD5 compatible with standard vectors', () => {
    expect(md5('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
    expect(md5('abc')).toBe('900150983cd24fb0d6963f7d28e17f72');
    expect(md5('message digest')).toBe('f96b697d7cb7938d525a2f31aaf161d0');
    expect(md5('中文')).toBe('a7bac2239fcdcb3a067903d8077c4a07');
  });

  it('patches visible rows for new adapters instead of reporting unsupported sync', async () => {
    document.body.innerHTML = `
      <table>
        <tr data-file-id="file-115">
          <td><span class="file-name" title="Episode 01.mkv"><span>Episode 01</span><span>.mkv</span></span></td>
        </tr>
      </table>
    `;

    const adapter = new Drive115Adapter({ requestInterval: 0 });
    const result = await adapter.syncAfterRename([
      { fileId: 'file-115', oldName: 'Episode 01.mkv', newName: 'Episode 01-fixed.mkv' },
    ]);

    const nameNode = document.querySelector<HTMLElement>('.file-name');
    expect(result.success).toBe(true);
    expect(result.method).toBe('dom-patch');
    expect(nameNode?.textContent?.replace(/\s+/g, '').trim()).toBe('Episode01-fixed.mkv');
    expect(nameNode?.getAttribute('title')).toBe('Episode 01-fixed.mkv');
  });
});
