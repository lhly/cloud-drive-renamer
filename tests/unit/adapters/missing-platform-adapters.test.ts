import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { Drive115Adapter } from '../../../src/adapters/115/adapter';
import { Drive123Adapter } from '../../../src/adapters/123/adapter';
import { CMCCAdapter, md5 } from '../../../src/adapters/cmcc/adapter';
import { EsurfingAdapter } from '../../../src/adapters/esurfing/adapter';
import { XunleiAdapter } from '../../../src/adapters/xunlei/adapter';
import { WoozoooAdapter } from '../../../src/adapters/woozooo/adapter';
import { GuangyaPanAdapter } from '../../../src/adapters/guangyapan/adapter';
import { getDrive115PageScriptInjector } from '../../../src/adapters/115/page-script-injector';
import { getDrive123PageScriptInjector } from '../../../src/adapters/123/page-script-injector';
import { getCMCCPageScriptInjector } from '../../../src/adapters/cmcc/page-script-injector';
import { CMCC_PAGE_SCRIPT_OPTIONS } from '../../../src/adapters/cmcc/page-script';
import { getEsurfingPageScriptInjector } from '../../../src/adapters/esurfing/page-script-injector';
import { getXunleiPageScriptInjector } from '../../../src/adapters/xunlei/page-script-injector';
import { XUNLEI_PAGE_SCRIPT_OPTIONS } from '../../../src/adapters/xunlei/page-script';
import { getWoozoooPageScriptInjector } from '../../../src/adapters/woozooo/page-script-injector';
import { WOOZOOO_PAGE_SCRIPT_OPTIONS } from '../../../src/adapters/woozooo/page-script';
import { getGuangyaPanPageScriptInjector } from '../../../src/adapters/guangyapan/page-script-injector';
import { GUANGYAPAN_PAGE_SCRIPT_OPTIONS } from '../../../src/adapters/guangyapan/page-script';
import { WKBrowserAdapter } from '../../../src/adapters/wkbrowser/adapter';
import { getWKBrowserPageScriptInjector } from '../../../src/adapters/wkbrowser/page-script-injector';
import { WKBROWSER_PAGE_SCRIPT_OPTIONS } from '../../../src/adapters/wkbrowser/page-script';

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

vi.mock('../../../src/adapters/xunlei/page-script-injector', () => ({
  getXunleiPageScriptInjector: vi.fn(),
}));

vi.mock('../../../src/adapters/woozooo/page-script-injector', () => ({
  getWoozoooPageScriptInjector: vi.fn(),
}));

vi.mock('../../../src/adapters/guangyapan/page-script-injector', () => ({
  getGuangyaPanPageScriptInjector: vi.fn(),
}));

vi.mock('../../../src/adapters/wkbrowser/page-script-injector', () => ({
  getWKBrowserPageScriptInjector: vi.fn(),
}));

describe('missing platform adapters', () => {
  let mock115CallAPI: Mock;
  let mock123CallAPI: Mock;
  let mockCMCCCallAPI: Mock;
  let mockEsurfingCallAPI: Mock;
  let mockXunleiCallAPI: Mock;
  let mockWoozoooCallAPI: Mock;
  let mockGuangyaPanCallAPI: Mock;
  let mockWKBrowserCallAPI: Mock;

  beforeEach(() => {
    mock115CallAPI = vi.fn();
    mock123CallAPI = vi.fn();
    mockCMCCCallAPI = vi.fn();
    mockEsurfingCallAPI = vi.fn();
    mockXunleiCallAPI = vi.fn();
    mockWoozoooCallAPI = vi.fn();
    mockGuangyaPanCallAPI = vi.fn();
    mockWKBrowserCallAPI = vi.fn();

    (globalThis as Record<string, unknown>).chrome = {
      runtime: { sendMessage: vi.fn(() => Promise.resolve({ success: true })) },
    };

    vi.mocked(getDrive115PageScriptInjector).mockReturnValue({ callAPI: mock115CallAPI });
    vi.mocked(getDrive123PageScriptInjector).mockReturnValue({ callAPI: mock123CallAPI });
    vi.mocked(getCMCCPageScriptInjector).mockReturnValue({ callAPI: mockCMCCCallAPI });
    vi.mocked(getEsurfingPageScriptInjector).mockReturnValue({ callAPI: mockEsurfingCallAPI });
    vi.mocked(getXunleiPageScriptInjector).mockReturnValue({ callAPI: mockXunleiCallAPI });
    vi.mocked(getWoozoooPageScriptInjector).mockReturnValue({ callAPI: mockWoozoooCallAPI });
    vi.mocked(getGuangyaPanPageScriptInjector).mockReturnValue({ callAPI: mockGuangyaPanCallAPI });
    vi.mocked(getWKBrowserPageScriptInjector).mockReturnValue({ callAPI: mockWKBrowserCallAPI });

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
    expect(mock123CallAPI.mock.calls[0][1]).toContain('https://yun.123pan.cn/b/api/file/list/new');
    expect(mock123CallAPI.mock.calls[0][1]).toContain('parentFileId=folder123');
    expect(mock123CallAPI).toHaveBeenNthCalledWith(
      2,
      'POST',
      'https://yun.123pan.cn/b/api/file/rename',
      expect.objectContaining({ fileId: 'file-123', fileName: 'Episode 01-fixed.mkv', duplicate: 1 }),
      30000
    );
  });

  it('does not duplicate CMCC explicit auth headers or capture encryption-triggering headers', () => {
    const headers = CMCC_PAGE_SCRIPT_OPTIONS.captureHeaders?.map((header) => header.toLowerCase());
    expect(headers).not.toContain('authorization');
    expect(headers).not.toContain('hcy-cool-flag');
  });

  it('parses CMCC list responses that arrive as JSON strings', async () => {
    const adapter = new CMCCAdapter({ requestInterval: 0 });
    localStorage.setItem('currentCatalogID', 'folder139');
    mockCMCCCallAPI.mockResolvedValue(JSON.stringify({
      code: '0000',
      message: '请求成功',
      data: {
        items: [{ fileId: 'file-139', name: 'Episode 01.mkv', parentFileId: 'folder139', fileExtension: 'mkv', size: 56, updatedAt: 789, type: 'file' }],
        nextPageCursor: null,
      },
    }));

    const files = await adapter.getAllFiles();

    expect(files[0]).toEqual({ id: 'file-139', name: 'Episode 01.mkv', ext: '.mkv', parentId: 'folder139', size: 56, mtime: 789 });
  });

  it('accepts CMCC rename responses with the real success code', async () => {
    const adapter = new CMCCAdapter({ requestInterval: 0 });
    mockCMCCCallAPI.mockResolvedValue({ code: '0000', message: '请求成功' });

    const result = await adapter.renameFile('file-139', 'Episode 01-fixed.mkv');

    expect(result).toEqual({ success: true, newName: 'Episode 01-fixed.mkv' });
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

  it('captures Xunlei dynamic API headers from native page requests', () => {
    const headers = XUNLEI_PAGE_SCRIPT_OPTIONS.captureHeaders?.map((header) => header.toLowerCase());
    expect(headers).toEqual(expect.arrayContaining([
      'authorization',
      'x-device-id',
      'x-client-id',
      'x-captcha-token',
      'content-type',
    ]));
  });

  it('uses Woozooo APIs from the same-origin file iframe and preserves server-managed extensions', async () => {
    const adapter = new WoozoooAdapter({ requestInterval: 0 });
    const iframe = document.createElement('iframe');
    iframe.id = 'mainframe';
    iframe.src = 'https://pc.woozooo.com/mydisk.php?item=files&action=index&u=484561';
    document.body.appendChild(iframe);
    const frameDoc = iframe.contentDocument!;
    frameDoc.open();
    frameDoc.write(`
      <input id="folder_id_bibao" value="8006795" />
      <script>function more(folder_id){ $.ajax({ data: { 'task':5,'folder_id':folder_id,'pg':pgs,'vei':'B1VQUgNRAw9TBFdW' } }); }</script>
    `);
    frameDoc.close();

    mockWoozoooCallAPI
      .mockResolvedValueOnce({
        zt: 1,
        info: 1,
        text: [{ id: '308207718', name: '未命名项目-图层 1.png', name_all: '未命名项目-图层 1.png', size: '246.6 K', time: '3 分钟前' }],
      })
      .mockResolvedValueOnce({
        zt: 1,
        info: 1,
        text: [{ id: '308207716', name: '数字键盘.jpg', name_all: '数字键盘.jpg', size: '68.2 K', time: '3 分钟前' }],
      })
      .mockResolvedValueOnce({ zt: 1, info: 0, text: [] })
      .mockResolvedValueOnce({ zt: 1, info: '新名称' });

    const files = await adapter.getAllFiles();
    const rename = await adapter.renameFile('308207718', '新名称.png');

    expect(files).toHaveLength(2);
    expect(files[0]).toMatchObject({ id: '308207718', name: '未命名项目-图层 1.png', ext: '.png', parentId: '8006795', size: 0 });
    expect(files[1]).toMatchObject({ id: '308207716', name: '数字键盘.jpg', ext: '.jpg', parentId: '8006795', size: 0 });
    expect(rename).toEqual({ success: true, newName: '新名称.png' });
    expect(mockWoozoooCallAPI).toHaveBeenNthCalledWith(
      1,
      'POST',
      'https://pc.woozooo.com/doupload.php?uid=484561',
      {
        bodyMode: 'urlencoded',
        entries: [
          ['task', '5'],
          ['folder_id', '8006795'],
          ['pg', '1'],
          ['vei', 'B1VQUgNRAw9TBFdW'],
        ],
      },
      30000
    );
    expect(mockWoozoooCallAPI).toHaveBeenNthCalledWith(
      4,
      'POST',
      'https://pc.woozooo.com/doupload.php',
      {
        bodyMode: 'urlencoded',
        entries: [
          ['task', '46'],
          ['file_id', '308207718'],
          ['file_name', '新名称'],
          ['type', '2'],
        ],
      },
      30000
    );
  });

  it('uses Xunlei APIs for listing and rename', async () => {
    const adapter = new XunleiAdapter({ requestInterval: 0 });
    Object.defineProperty(window, 'location', {
      value: {
        href: 'https://pan.xunlei.com/?path=%2F%E6%88%91%E7%9A%84%E8%B5%84%E6%BA%90%2F%E5%AD%90%E7%9B%AE%E5%BD%95%2F%E5%BD%93%E5%89%8D%E7%9B%AE%E5%BD%95',
        search: '?path=%2F%E6%88%91%E7%9A%84%E8%B5%84%E6%BA%90%2F%E5%AD%90%E7%9B%AE%E5%BD%95%2F%E5%BD%93%E5%89%8D%E7%9B%AE%E5%BD%95',
        pathname: '/',
        hash: '',
      },
      writable: true,
      configurable: true,
    });
    localStorage.setItem('xlPanHomeRoutes', JSON.stringify({
      '/我的资源/子目录/当前目录': '/root-xl/child-xl/folder-xl',
    }));

    mockXunleiCallAPI
      .mockResolvedValueOnce({
        kind: 'drive#fileList',
        next_page_token: '',
        files: [{
          kind: 'drive#file',
          id: 'file-xl',
          parent_id: 'folder-xl',
          name: 'Episode 01.mkv',
          file_extension: '.mkv',
          size: '12345',
          modified_time: '2026-08-15T09:00:00.000+08:00',
        }],
      })
      .mockResolvedValueOnce({ id: 'file-xl', name: 'Episode 01-fixed.mkv' });

    const files = await adapter.getAllFiles();
    const rename = await adapter.renameFile('file-xl', 'Episode 01-fixed.mkv');

    expect(files[0]).toMatchObject({ id: 'file-xl', name: 'Episode 01.mkv', ext: '.mkv', parentId: 'folder-xl', size: 12345 });
    expect(rename).toEqual({ success: true, newName: 'Episode 01-fixed.mkv' });
    expect(mockXunleiCallAPI.mock.calls[0][1]).toContain('https://api-pan.xunlei.com/drive/v1/files');
    expect(mockXunleiCallAPI.mock.calls[0][1]).toContain('parent_id=folder-xl');
    expect(mockXunleiCallAPI.mock.calls[0][1]).not.toContain('parent_id=root-xl%2Fchild-xl%2Ffolder-xl');
    expect(mockXunleiCallAPI.mock.calls[0][1]).toContain('limit=50');
    expect(mockXunleiCallAPI).toHaveBeenNthCalledWith(
      2,
      'PATCH',
      'https://api-pan.xunlei.com/drive/v1/files/file-xl',
      { name: 'Episode 01-fixed.mkv' },
      30000
    );
  });

  it('uses no special captured headers for Woozooo page-script requests', () => {
    expect(WOOZOOO_PAGE_SCRIPT_OPTIONS.captureHeaders ?? []).toEqual([]);
  });

  it('throws instead of returning an empty list when Xunlei list API fails', async () => {
    const adapter = new XunleiAdapter({ requestInterval: 0 });
    mockXunleiCallAPI.mockResolvedValue({ error: 'bad_request', error_description: 'list failed' });

    await expect(adapter.getAllFiles()).rejects.toThrow('list failed');
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

  it('reports CMCC response shape when the list payload is missing', async () => {
    const adapter = new CMCCAdapter({ requestInterval: 0 });
    localStorage.setItem('currentCatalogID', 'folder139');
    mockCMCCCallAPI.mockResolvedValue({ code: 0, data: { catalogList: [] } });

    await expect(adapter.getAllFiles()).rejects.toThrow('response keys: code,data; data keys: catalogList');
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

  it('patches 115 visible rows inside the file-list iframe after rename', async () => {
    document.body.innerHTML = '<iframe></iframe>';
    const frame = document.querySelector('iframe');
    const frameDocument = frame?.contentDocument;
    expect(frameDocument).toBeTruthy();

    frameDocument!.body.innerHTML = `
      <ul>
        <li rel="item" file_id="file-115" title="Episode 01.mkv">
          <span class="file-name" rel="file_name">
            <em>
              <a class="name" href="javascript:;" title="Episode 01.mkv" rel="file" field="file_name">
                <span></span><span>Episode 01.mkv</span>
              </a>
              <a href="javascript:;" class="icon-star">星标</a>
            </em>
          </span>
        </li>
      </ul>
    `;

    const adapter = new Drive115Adapter({ requestInterval: 0 });
    const result = await adapter.syncAfterRename([
      { fileId: 'file-115', oldName: 'Episode 01.mkv', newName: 'Episode 01-fixed.mkv' },
    ]);

    const row = frameDocument!.querySelector<HTMLElement>('li[file_id="file-115"]');
    const link = frameDocument!.querySelector<HTMLElement>('a.name');
    expect(result.success).toBe(true);
    expect(result.method).toBe('dom-patch');
    expect(row?.getAttribute('title')).toBe('Episode 01-fixed.mkv');
    expect(link?.getAttribute('title')).toBe('Episode 01-fixed.mkv');
    expect(link?.textContent?.replace(/\s+/g, '').trim()).toBe('Episode01-fixed.mkv');
  });

  it('patches 115 split filename text nodes inside iframe rows', async () => {
    document.body.innerHTML = '<iframe></iframe>';
    const frameDocument = document.querySelector('iframe')?.contentDocument;
    expect(frameDocument).toBeTruthy();

    frameDocument!.body.innerHTML = `
      <ul>
        <li rel="item" file_id="file-115" title="《啊哈！算法》.pdf">
          <span class="file-name" rel="file_name">
            <em>
              <a class="name" href="javascript:;" title="《啊哈！算法》.pdf" rel="file" field="file_name">
                <span>《</span><span>啊哈！算法》.pdf</span>
              </a>
              <a href="javascript:;" class="icon-star">星标</a>
            </em>
          </span>
        </li>
      </ul>
    `;

    const adapter = new Drive115Adapter({ requestInterval: 0 });
    const result = await adapter.syncAfterRename([
      { fileId: 'file-115', oldName: '《啊哈！算法》.pdf', newName: 'test-《啊哈！算法》.pdf' },
    ]);

    const link = frameDocument!.querySelector<HTMLElement>('a.name');
    expect(result.success).toBe(true);
    expect(result.method).toBe('dom-patch');
    expect(link?.getAttribute('title')).toBe('test-《啊哈！算法》.pdf');
    expect(link?.textContent?.replace(/\s+/g, '').trim()).toBe('test-《啊哈！算法》.pdf');
  });

  it('patches 123Pan visible rows with Ant Table filename classes after rename', async () => {
    document.body.innerHTML = `
      <div class="ant-table-row editable-row" data-row-key="file-123">
        <div class="ant-table-cell drag-visible ant-table-cell-ellipsis mfy-table-row">
          <div class="custom-dropdown context-menu-wrapper">
            <div class="custom-dropdown-content">
              <div class="table-list-file-name">
                <div class="file-icon-wrapper"><img alt="Android-apk icon" /></div>
                <div class="file-name-wrapper">
                  <span class="table-file-name-tooltip-host">
                    <div class="overflow-detector-container">
                      <span class="overflow-detector-container-text table-file-name overflowing">test-WADBS_1.3.apk</span>
                    </div>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const adapter = new Drive123Adapter({ requestInterval: 0 });
    const result = await adapter.syncAfterRename([
      { fileId: 'file-123', oldName: 'test-WADBS_1.3.apk', newName: 'WADBS_1.3.apk' },
    ]);

    const nameNode = document.querySelector<HTMLElement>('.table-file-name');
    expect(result.success).toBe(true);
    expect(result.method).toBe('dom-patch');
    expect(nameNode?.textContent).toBe('WADBS_1.3.apk');
  });

  it('patches Xunlei visible rows with SourceListItem filename classes after rename', async () => {
    document.body.innerHTML = `
      <ul>
        <li data-file-id="file-xl" class="SourceListItem__item--XxpOC">
          <div class="SourceListItem__main--c9HnH">
            <div class="SourceListItem__content--bJbFo">
              <div class="SourceListItem__title--fq2DG">
                <a class="SourceListItem__name--y6dVw">Episode 01.mkv</a>
              </div>
            </div>
          </div>
        </li>
      </ul>
    `;

    const adapter = new XunleiAdapter({ requestInterval: 0 });
    const result = await adapter.syncAfterRename([
      { fileId: 'file-xl', oldName: 'Episode 01.mkv', newName: 'Episode 01-fixed.mkv' },
    ]);

    const nameNode = document.querySelector<HTMLElement>('[class*="SourceListItem__name"]');
    expect(result.success).toBe(true);
    expect(result.method).toBe('dom-patch');
    expect(nameNode?.textContent).toBe('Episode 01-fixed.mkv');
  });

  it('patches CMCC visible rows with document table filename classes after rename', async () => {
    document.body.innerHTML = `
      <div class="main_file_list">
        <div class="document_table_list">
          <div class="document_table_list_name name-col-3-item">
            <div class="document_table_list_name_text">
              <div class="touch-div"><span>未命名项目-图层 1.png</span></div>
              <span class="mirror-name">未命名项目-图层 1.png</span>
            </div>
          </div>
          <div class="document_table_list_time">今天 11:40</div>
          <div class="document_table_list_size">246.59KB</div>
        </div>
      </div>
    `;

    const adapter = new CMCCAdapter({ requestInterval: 0 });
    const result = await adapter.syncAfterRename([
      { fileId: 'file-139', oldName: '未命名项目-图层 1.png', newName: 'test-未命名项目-图层 1.png' },
    ]);

    const nameNode = document.querySelector<HTMLElement>('.touch-div');
    expect(result.success).toBe(true);
    expect(result.method).toBe('dom-patch');
    expect(nameNode?.textContent).toBe('test-未命名项目-图层 1.png');
  });

  it('disconnects older DOM sync observers before undo sync starts', async () => {
    document.body.innerHTML = '<main id="file-list"></main>';

    const adapter = new CMCCAdapter({ requestInterval: 0 });
    await adapter.syncAfterRename([
      { fileId: 'file-139', oldName: '未命名项目-图层 1.png', newName: 'test-未命名项目-图层 1.png' },
    ]);
    await adapter.syncAfterRename([
      { fileId: 'file-139', oldName: 'test-未命名项目-图层 1.png', newName: '未命名项目-图层 1.png' },
    ]);

    const observedNames: string[] = [];
    const observer = new MutationObserver(() => {
      const text = document.querySelector<HTMLElement>('.touch-div')?.textContent?.trim();
      if (text) observedNames.push(text);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    document.querySelector('#file-list')!.insertAdjacentHTML('beforeend', `
      <div class="document_table_list">
        <div class="document_table_list_name_text">
          <div class="touch-div"><span>未命名项目-图层 1.png</span></div>
        </div>
      </div>
    `);
    await new Promise((resolve) => window.setTimeout(resolve, 20));
    observer.disconnect();

    expect(observedNames).not.toContain('test-未命名项目-图层 1.png');
    expect(document.querySelector<HTMLElement>('.touch-div')?.textContent).toBe('未命名项目-图层 1.png');
  });

  it('patches later 123Pan row mutations without rescanning the whole document', async () => {
    document.body.innerHTML = '<main id="file-list"></main>';

    const querySelectorAll = vi.spyOn(document, 'querySelectorAll');
    const adapter = new Drive123Adapter({ requestInterval: 0 });
    await adapter.syncAfterRename([
      { fileId: 'file-123', oldName: 'test-WADBS_1.3.apk', newName: 'WADBS_1.3.apk' },
    ]);
    querySelectorAll.mockClear();

    document.querySelector('#file-list')!.insertAdjacentHTML('beforeend', `
      <div class="ant-table-row editable-row" data-row-key="file-123">
        <span class="table-file-name">test-WADBS_1.3.apk</span>
      </div>
    `);
    await new Promise((resolve) => window.setTimeout(resolve, 10));

    expect(document.querySelector<HTMLElement>('.table-file-name')?.textContent).toBe('WADBS_1.3.apk');
    expect(querySelectorAll).not.toHaveBeenCalled();
  });

  it('patches Woozooo iframe rows with f_name_title nodes after rename', async () => {
    const adapter = new WoozoooAdapter({ requestInterval: 0 });
    const iframe = document.createElement('iframe');
    iframe.id = 'mainframe';
    document.body.appendChild(iframe);
    const frameDoc = iframe.contentDocument!;
    frameDoc.body.innerHTML = `
      <div id="f308207718" class="f_tb">
        <div class="f_name"><span class="f_name_title" id="filename308207718">旧名称.png</span></div>
      </div>
    `;

    const result = await adapter.syncAfterRename([{ fileId: '308207718', oldName: '旧名称.png', newName: '新名称.png' }]);

    expect(result.success).toBe(true);
    expect(result.method).toBe('dom-patch');
    expect(frameDoc.querySelector('#filename308207718')?.textContent).toBe('新名称.png');
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

  // --- GuangyaPan adapter tests ---

  it('captures GuangyaPan dynamic API headers from native page XHR requests', () => {
    const headers = GUANGYAPAN_PAGE_SCRIPT_OPTIONS.captureHeaders?.map((header) => header.toLowerCase());
    expect(headers).toEqual(expect.arrayContaining([
      'authorization',
      'did',
      'smid',
      'dt',
      'traceparent',
      'content-type',
    ]));
  });

  it('routes GuangyaPan API calls through the background proxy instead of page-script', async () => {
    const adapter = new GuangyaPanAdapter({ requestInterval: 0 });
    Object.defineProperty(window, 'location', {
      value: { href: 'https://www.guangyapan.com/#/home/all', search: '', pathname: '/', hash: '#/home/all' },
      writable: true,
      configurable: true,
    });

    localStorage.setItem('credentials_test', JSON.stringify({ access_token: 'gyp-token-abc' }));
    localStorage.setItem('swangpan_web_device_id', 'device-123');
    localStorage.setItem('shumei_id:v1', 'smid-base64');

    const sendMessageMock = vi.fn().mockResolvedValue({
      success: true,
      data: { msg: 'success', data: { total: 1, list: [{ fileId: 'g-1', fileName: 'a.mp4', fileSize: 10, dirType: 1, ext: '.mp4', ctime: '', utime: '' }] } },
    });
    (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mockImplementation(sendMessageMock);

    const files = await adapter.getAllFiles();

    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ id: 'g-1', name: 'a.mp4' });

    expect(sendMessageMock).toHaveBeenCalled();
    const sentMessage = sendMessageMock.mock.calls[0][0];
    expect(sentMessage.type).toBe('GUANGYAPAN_API_REQUEST');
    expect(sentMessage.method).toBe('POST');
    expect(sentMessage.url).toBe('https://api.guangyapan.com/userres/v1/file/get_file_list');
    expect(sentMessage.headers).toMatchObject({
      'Authorization': 'Bearer gyp-token-abc',
      'did': 'device-123',
      'smid': 'smid-base64',
      'dt': '4',
      'Accept': 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
    });
    expect(sentMessage.headers.traceparent).toMatch(/^00-[a-f0-9]{32}-[a-f0-9]{16}-01$/);
  });

  it('rate limits GuangyaPan background API calls between paginated requests', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T00:00:00.000Z'));
    const adapter = new GuangyaPanAdapter({ requestInterval: 1000 });
    Object.defineProperty(window, 'location', {
      value: { href: 'https://www.guangyapan.com/#/home/all', search: '', pathname: '/', hash: '#/home/all' },
      writable: true,
      configurable: true,
    });

    const sendMessageMock = (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>);
    sendMessageMock
      .mockResolvedValueOnce({
        success: true,
        data: {
          msg: 'success',
          data: {
            total: 2,
            list: [{ fileId: 'g-1', fileName: 'a.mp4', fileSize: 10, dirType: 1, ext: '.mp4', ctime: '', utime: '' }],
          },
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          msg: 'success',
          data: {
            total: 2,
            list: [{ fileId: 'g-2', fileName: 'b.mp4', fileSize: 20, dirType: 1, ext: '.mp4', ctime: '', utime: '' }],
          },
        },
      });

    const filesPromise = adapter.getAllFiles();
    await vi.advanceTimersByTimeAsync(0);
    expect(sendMessageMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(999);
    expect(sendMessageMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await expect(filesPromise).resolves.toHaveLength(2);
    expect(sendMessageMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('uses XHR transport for GuangyaPan so request header casing is preserved', () => {
    expect(GUANGYAPAN_PAGE_SCRIPT_OPTIONS.transport).toBe('xhr');
  });

  it('uses GuangyaPan APIs for paginated listing and rename', async () => {
    const adapter = new GuangyaPanAdapter({ requestInterval: 0 });
    Object.defineProperty(window, 'location', {
      value: {
        href: 'https://www.guangyapan.com/#/home/all',
        search: '',
        pathname: '/',
        hash: '#/home/all',
      },
      writable: true,
      configurable: true,
    });

    localStorage.setItem('credentials_test', JSON.stringify({ access_token: 'tok' }));
    const sendMessageMock = (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>);
    sendMessageMock
      .mockResolvedValueOnce({
        success: true,
        data: {
          msg: 'success',
          data: {
            total: 2,
            list: [
              { fileId: 'gyp-1', fileName: 'Episode 01.mkv', fileSize: 100, dirType: 1, mineType: 'video', ext: '.mkv', ctime: '2026-01-01', utime: '2026-01-02' },
              { fileId: 'gyp-2', fileName: 'Episode 02.mkv', fileSize: 200, dirType: 1, mineType: 'video', ext: '.mkv', ctime: '2026-01-01', utime: '2026-01-03' },
            ],
          },
        },
      })
      .mockResolvedValueOnce({ success: true, data: { msg: 'success' } });

    const files = await adapter.getAllFiles();
    const rename = await adapter.renameFile('gyp-1', 'Episode 01-fixed.mkv');

    expect(files).toHaveLength(2);
    expect(files[0]).toEqual({ id: 'gyp-1', name: 'Episode 01.mkv', ext: '.mkv', parentId: '', size: 100, mtime: expect.any(Number) });
    expect(files[1]).toEqual({ id: 'gyp-2', name: 'Episode 02.mkv', ext: '.mkv', parentId: '', size: 200, mtime: expect.any(Number) });
    expect(rename).toEqual({ success: true, newName: 'Episode 01-fixed.mkv' });
    expect(sendMessageMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      type: 'GUANGYAPAN_API_REQUEST',
      method: 'POST',
      url: 'https://api.guangyapan.com/userres/v1/file/get_file_list',
      body: { pageSize: 50, orderBy: 3, sortType: 1, parentId: '', page: 0 },
    }));
    expect(sendMessageMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      type: 'GUANGYAPAN_API_REQUEST',
      method: 'POST',
      url: 'https://api.guangyapan.com/userres/v1/file/rename',
      body: { fileId: 'gyp-1', newName: 'Episode 01-fixed.mkv' },
    }));
  });

  it('paginates GuangyaPan listing until all items are loaded', async () => {
    const adapter = new GuangyaPanAdapter({ requestInterval: 0 });
    Object.defineProperty(window, 'location', {
      value: { href: 'https://www.guangyapan.com/#/home/all', search: '', pathname: '/', hash: '#/home/all' },
      writable: true,
      configurable: true,
    });

    const sendMessageMock = (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>);
    sendMessageMock
      .mockResolvedValueOnce({
        success: true,
        data: {
          msg: 'success',
          data: {
            total: 2,
            list: [{ fileId: 'g-1', fileName: 'a.mp4', fileSize: 10, dirType: 1, ext: '.mp4', ctime: '', utime: '' }],
          },
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          msg: 'success',
          data: {
            total: 2,
            list: [{ fileId: 'g-2', fileName: 'b.mp4', fileSize: 20, dirType: 1, ext: '.mp4', ctime: '', utime: '' }],
          },
        },
      });

    const files = await adapter.getAllFiles();

    expect(files).toHaveLength(2);
    expect(sendMessageMock).toHaveBeenCalledTimes(2);
    expect(sendMessageMock.mock.calls[0][0].body).toMatchObject({ page: 0 });
    expect(sendMessageMock.mock.calls[1][0].body).toMatchObject({ page: 1 });
  });

  it('parses GuangyaPan hash route to get current folder ID', async () => {
    const adapter = new GuangyaPanAdapter({ requestInterval: 0 });
    Object.defineProperty(window, 'location', {
      value: {
        href: 'https://www.guangyapan.com/#/home/all/12345-some-folder/67890-subfolder',
        search: '',
        pathname: '/',
        hash: '#/home/all/12345-some-folder/67890-subfolder',
      },
      writable: true,
      configurable: true,
    });

    const sendMessageMock = (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>);
    sendMessageMock.mockResolvedValueOnce({
      success: true,
      data: { msg: 'success', data: { total: 0, list: [] } },
    });

    await adapter.getAllFiles();

    expect(sendMessageMock).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.objectContaining({ parentId: '67890' }),
    }));
  });

  it('parses GuangyaPan file IDs correctly when names contain hyphens', async () => {
    const adapter = new GuangyaPanAdapter({ requestInterval: 0 });
    Object.defineProperty(window, 'location', {
      value: {
        href: 'https://www.guangyapan.com/#/home/all/12345-ep-01-mkv',
        search: '',
        pathname: '/',
        hash: '#/home/all/12345-ep-01-mkv',
      },
      writable: true,
      configurable: true,
    });

    const sendMessageMock = (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>);
    sendMessageMock.mockResolvedValueOnce({
      success: true,
      data: { msg: 'success', data: { total: 0, list: [] } },
    });

    await adapter.getAllFiles();

    expect(sendMessageMock).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.objectContaining({ parentId: '12345' }),
    }));
  });

  it('throws GuangyaPan background status 0 instead of unknown when the proxy fails without an error message', async () => {
    const adapter = new GuangyaPanAdapter({ requestInterval: 0 });
    const sendMessageMock = (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>);
    sendMessageMock.mockResolvedValueOnce({ success: false, status: 0 });

    await expect(adapter.getAllFiles()).rejects.toThrow('GuangyaPan API request failed with status 0');
  });

  it('throws instead of returning an empty list when GuangyaPan list API fails', async () => {
    const adapter = new GuangyaPanAdapter({ requestInterval: 0 });
    const sendMessageMock = (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>);
    sendMessageMock.mockResolvedValue({
      success: true,
      data: { msg: 'error', data: null },
    });

    await expect(adapter.getAllFiles()).rejects.toThrow();
  });

  it('patches GuangyaPan visible rows with swangpan filename classes after rename', async () => {
    document.body.innerHTML = `
      <div class="swangpan-file-list-table__body" role="list">
        <div class="swangpan-file-list-table__row" role="listitem">
          <div class="swangpan-file-list-table__label" title="Episode 01.mkv">Episode 01.mkv</div>
        </div>
      </div>
    `;

    const adapter = new GuangyaPanAdapter({ requestInterval: 0 });
    const result = await adapter.syncAfterRename([
      { fileId: 'gyp-1', oldName: 'Episode 01.mkv', newName: 'Episode 01-fixed.mkv' },
    ]);

    const labelNode = document.querySelector<HTMLElement>('.swangpan-file-list-table__label');
    expect(result.success).toBe(true);
    expect(result.method).toBe('dom-patch');
    expect(labelNode?.textContent).toBe('Episode 01-fixed.mkv');
    expect(labelNode?.getAttribute('title')).toBe('Episode 01-fixed.mkv');
  });

  it('patches GuangyaPan rows inserted by virtual-list rerender after syncAfterRename', async () => {
    document.body.innerHTML = `
      <div class="swangpan-file-list-table__body" role="list">
        <div class="swangpan-file-list-table__row" role="listitem">
          <div class="swangpan-file-list-table__label" title="Episode 01.mkv">Episode 01.mkv</div>
        </div>
      </div>
    `;

    const adapter = new GuangyaPanAdapter({ requestInterval: 0 });
    await adapter.syncAfterRename([
      { fileId: 'gyp-1', oldName: 'Episode 01.mkv', newName: 'Episode 01-fixed.mkv' },
    ]);

    // Verify the initial synchronous patch worked
    const label = document.querySelector<HTMLElement>('.swangpan-file-list-table__label')!;
    expect(label.textContent).toBe('Episode 01-fixed.mkv');
    expect(label.getAttribute('title')).toBe('Episode 01-fixed.mkv');

    // Simulate React re-render replacing the row with the old filename
    // This exercises the MutationObserver path where the body is the mutation
    // root and the new row+label are descendant nodes.
    document.querySelector('.swangpan-file-list-table__body')!.innerHTML = `
      <div class="swangpan-file-list-table__row" role="listitem">
        <div class="swangpan-file-list-table__label" title="Episode 01.mkv">Episode 01.mkv</div>
      </div>
    `;
    await new Promise((resolve) => window.setTimeout(resolve, 20));

    const newLabel = document.querySelector<HTMLElement>('.swangpan-file-list-table__label')!;
    expect(newLabel.textContent).toBe('Episode 01-fixed.mkv');
    expect(newLabel.getAttribute('title')).toBe('Episode 01-fixed.mkv');
  });

  it('patches GuangyaPan label when mutation target is the label itself (characterData path)', async () => {
    // Set up a row with an empty label, install observer, then set textContent
    // to trigger a characterData mutation where the target is a text node
    // inside the label. The observer's getMutationPatchRoots must resolve
    // the label's parent .swangpan-file-list-table__row as the root so the
    // label is found via querySelectorAll on the root.
    document.body.innerHTML = `
      <div class="swangpan-file-list-table__body" role="list">
        <div class="swangpan-file-list-table__row" role="listitem">
          <div class="swangpan-file-list-table__label" title="Episode 01.mkv"></div>
        </div>
      </div>
    `;

    const adapter = new GuangyaPanAdapter({ requestInterval: 0 });
    await adapter.syncAfterRename([
      { fileId: 'gyp-1', oldName: 'Episode 01.mkv', newName: 'Episode 01-fixed.mkv' },
    ]);

    const label = document.querySelector<HTMLElement>('.swangpan-file-list-table__label')!;

    // Trigger a textContent change on the label
    label.textContent = 'Episode 01.mkv';
    await new Promise((resolve) => window.setTimeout(resolve, 20));

    // The label should be patched by the observer
    expect(label.textContent).toBe('Episode 01-fixed.mkv');
    expect(label.getAttribute('title')).toBe('Episode 01-fixed.mkv');
  });

  it('maps GuangyaPan selected DOM rows to getAllFiles results by fileName', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        href: 'https://www.guangyapan.com/#/home/all',
        search: '',
        pathname: '/',
        hash: '#/home/all',
      },
      writable: true,
      configurable: true,
    });

    const adapter = new GuangyaPanAdapter({ requestInterval: 0 });

    document.body.innerHTML = `
      <div class="swangpan-file-list-table__body" role="list">
        <div class="swangpan-file-list-table__row swangpan-file-list-table__row--selected" role="listitem">
          <div class="swangpan-checkbox" data-state="checked"></div>
          <div class="swangpan-file-list-table__label" title="Episode 01.mkv">Episode 01.mkv</div>
        </div>
        <div class="swangpan-file-list-table__row" role="listitem">
          <div class="swangpan-checkbox" data-state=""></div>
          <div class="swangpan-file-list-table__label" title="Episode 02.mkv">Episode 02.mkv</div>
        </div>
      </div>
    `;

    const sendMessageMock = (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>);
    sendMessageMock.mockResolvedValueOnce({
      success: true,
      data: {
        msg: 'success',
        data: {
          total: 2,
          list: [
            { fileId: 'gyp-1', fileName: 'Episode 01.mkv', fileSize: 100, dirType: 1, ext: '.mkv', ctime: '', utime: '' },
            { fileId: 'gyp-2', fileName: 'Episode 02.mkv', fileSize: 200, dirType: 1, ext: '.mkv', ctime: '', utime: '' },
          ],
        },
      },
    });

    const selected = await adapter.getSelectedFiles();

    expect(selected).toHaveLength(1);
    expect(selected[0]).toMatchObject({ id: 'gyp-1', name: 'Episode 01.mkv' });
  });

  it('maps GuangyaPan selected rows using real site data-state="selected" and checked checkbox input', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        href: 'https://www.guangyapan.com/#/home/all',
        search: '',
        pathname: '/',
        hash: '#/home/all',
      },
      writable: true,
      configurable: true,
    });

    const adapter = new GuangyaPanAdapter({ requestInterval: 0 });

    // Simulates the real GuangyaPan DOM observed in Chrome DevTools:
    // - Row: data-state="selected" (not a CSS class modifier)
    // - Checkbox: input.swangpan-checkbox__input with checked=true, aria-checked="true"
    // - Label root: label.swangpan-checkbox__root with data-state="checked"
    document.body.innerHTML = `
      <div class="swangpan-file-list-table__body" role="list">
        <div class="swangpan-file-list-table__row" data-state="selected" role="listitem">
          <label class="swangpan-checkbox__root" data-state="checked">
            <input class="swangpan-checkbox__input" type="checkbox" checked aria-checked="true" />
          </label>
          <div class="swangpan-file-list-table__label" title="\u672a\u547d\u540d\u9879\u76ee-\u56fe\u5c42 1.png">\u672a\u547d\u540d\u9879\u76ee-\u56fe\u5c42 1.png</div>
        </div>
        <div class="swangpan-file-list-table__row" role="listitem">
          <label class="swangpan-checkbox__root" data-state="">
            <input class="swangpan-checkbox__input" type="checkbox" />
          </label>
          <div class="swangpan-file-list-table__label" title="Episode 02.mkv">Episode 02.mkv</div>
        </div>
      </div>
    `;

    const sendMessageMock = (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>);
    sendMessageMock.mockResolvedValueOnce({
      success: true,
      data: {
        msg: 'success',
        data: {
          total: 2,
          list: [
            { fileId: 'gyp-1', fileName: '\u672a\u547d\u540d\u9879\u76ee-\u56fe\u5c42 1.png', fileSize: 100, dirType: 1, ext: '.png', ctime: '', utime: '' },
            { fileId: 'gyp-2', fileName: 'Episode 02.mkv', fileSize: 200, dirType: 1, ext: '.mkv', ctime: '', utime: '' },
          ],
        },
      },
    });

    const selected = await adapter.getSelectedFiles();

    expect(selected).toHaveLength(1);
    expect(selected[0]).toMatchObject({ id: 'gyp-1', name: '\u672a\u547d\u540d\u9879\u76ee-\u56fe\u5c42 1.png' });
  });

  // --- WKBrowser adapter tests ---

  it('uses WKBrowser APIs for paginated listing with filter_file', async () => {
    const adapter = new WKBrowserAdapter({ requestInterval: 0 });
    Object.defineProperty(window, 'location', {
      value: { href: 'https://pan.wkbrowser.com/main?category=all', search: '?category=all', pathname: '/main', hash: '' },
      writable: true,
      configurable: true,
    });

    mockWKBrowserCallAPI
      .mockResolvedValueOnce({
        code: 0,
        message: 'success',
        data: {
          file_list: [
            { file_id: 101, file_name: 'Episode 01.mkv', father_id: 0, extension: 'mkv', is_directory: 0, file_type: 2000, size: 100, updated_at: 1700000000, created_at: 1700000000 },
            { file_id: 102, file_name: 'Folder1', father_id: 0, extension: '', is_directory: 1, file_type: 0, size: 0, updated_at: 1700000000, created_at: 1700000000 },
          ],
          has_more: 0,
        },
      });

    const files = await adapter.getAllFiles();

    // Should skip directories (is_directory: 1)
    expect(files).toHaveLength(1);
    expect(files[0]).toEqual({
      id: '101',
      name: 'Episode 01.mkv',
      ext: '.mkv',
      parentId: '0',
      size: 100,
      mtime: 1700000000000, // Unix seconds -> ms
    });
    expect(mockWKBrowserCallAPI).toHaveBeenNthCalledWith(
      1,
      'POST',
      expect.stringContaining('https://api.wkbrowser.com/netdisk/user_file/filter_file?offset=0&limit=20&'),
      { father_id: 0, filter_type: 2, is_desc: 1, file_type: 0 },
      30000
    );
  });

  it('paginates WKBrowser listing until has_more is false', async () => {
    const adapter = new WKBrowserAdapter({ requestInterval: 0 });
    Object.defineProperty(window, 'location', {
      value: { href: 'https://pan.wkbrowser.com/main?category=all', search: '?category=all', pathname: '/main', hash: '' },
      writable: true,
      configurable: true,
    });

    mockWKBrowserCallAPI
      .mockResolvedValueOnce({
        code: 0,
        message: 'success',
        data: {
          file_list: [
            { file_id: 1, file_name: 'a.mp4', father_id: 0, extension: 'mp4', is_directory: 0, file_type: 2000, size: 10, updated_at: 1700000000, created_at: 1700000000 },
            { file_id: 2, file_name: 'b.mp4', father_id: 0, extension: 'mp4', is_directory: 0, file_type: 2000, size: 20, updated_at: 1700000000, created_at: 1700000000 },
          ],
          has_more: 1,
        },
      })
      .mockResolvedValueOnce({
        code: 0,
        message: 'success',
        data: {
          file_list: [
            { file_id: 3, file_name: 'c.mp4', father_id: 0, extension: 'mp4', is_directory: 0, file_type: 2000, size: 30, updated_at: 1700000000, created_at: 1700000000 },
          ],
          has_more: 0,
        },
      });

    const files = await adapter.getAllFiles();

    expect(files).toHaveLength(3);
    expect(mockWKBrowserCallAPI).toHaveBeenCalledTimes(2);
    expect(mockWKBrowserCallAPI.mock.calls[0][1]).toContain('offset=0');
    expect(mockWKBrowserCallAPI.mock.calls[1][1]).toContain('offset=2');
  });

  it('uses WKBrowser rename endpoint with correct body', async () => {
    const adapter = new WKBrowserAdapter({ requestInterval: 0 });
    Object.defineProperty(window, 'location', {
      value: { href: 'https://pan.wkbrowser.com/main?category=all', search: '?category=all', pathname: '/main', hash: '' },
      writable: true,
      configurable: true,
    });

    mockWKBrowserCallAPI.mockResolvedValueOnce({ code: 0, message: 'success' });

    const result = await adapter.renameFile('101', 'Episode 01-fixed.mkv');

    expect(result).toEqual({ success: true, newName: 'Episode 01-fixed.mkv' });
    expect(mockWKBrowserCallAPI).toHaveBeenNthCalledWith(
      1,
      'POST',
      expect.stringContaining('https://api.wkbrowser.com/netdisk/user_file/rename_file?'),
      { file_id: 101, new_name: 'Episode 01-fixed.mkv' },
      30000
    );
  });

  it('throws instead of returning empty list when WKBrowser list API fails', async () => {
    const adapter = new WKBrowserAdapter({ requestInterval: 0 });
    Object.defineProperty(window, 'location', {
      value: { href: 'https://pan.wkbrowser.com/main?category=all', search: '?category=all', pathname: '/main', hash: '' },
      writable: true,
      configurable: true,
    });

    mockWKBrowserCallAPI.mockResolvedValueOnce({ code: 60006, message: 'file not found' });

    await expect(adapter.getAllFiles()).rejects.toThrow('文件不存在');
  });

  it('maps WKBrowser selected Arco table rows to getAllFiles by checkbox value', async () => {
    const adapter = new WKBrowserAdapter({ requestInterval: 0 });
    Object.defineProperty(window, 'location', {
      value: { href: 'https://pan.wkbrowser.com/main?category=all', search: '?category=all', pathname: '/main', hash: '' },
      writable: true,
      configurable: true,
    });

    document.body.innerHTML = `
      <table>
        <thead>
          <tr class="arco-table-tr">
            <th><input type="checkbox" /></th>
            <th>Name</th>
          </tr>
        </thead>
        <tbody class="arco-table-body">
          <tr class="arco-table-tr h-48 arco-table-row-checked">
            <td><input type="checkbox" value="101" checked /></td>
            <td>Episode 01.mkv</td>
          </tr>
          <tr class="arco-table-tr h-48">
            <td><input type="checkbox" value="102" /></td>
            <td>Episode 02.mkv</td>
          </tr>
        </tbody>
      </table>
    `;

    mockWKBrowserCallAPI.mockResolvedValueOnce({
      code: 0,
      message: 'success',
      data: {
        file_list: [
          { file_id: 101, file_name: 'Episode 01.mkv', father_id: 0, extension: 'mkv', is_directory: 0, file_type: 2000, size: 100, updated_at: 1700000000, created_at: 1700000000 },
          { file_id: 102, file_name: 'Episode 02.mkv', father_id: 0, extension: 'mkv', is_directory: 0, file_type: 2000, size: 200, updated_at: 1700000000, created_at: 1700000000 },
        ],
        has_more: 0,
      },
    });

    const selected = await adapter.getSelectedFiles();

    expect(selected).toHaveLength(1);
    expect(selected[0]).toMatchObject({ id: '101', name: 'Episode 01.mkv' });
  });

  it('uses no special captured headers for WKBrowser page-script requests', () => {
    expect(WKBROWSER_PAGE_SCRIPT_OPTIONS.captureHeaders ?? []).toEqual([]);
  });

  it('patches WKBrowser Arco table rows after rename', async () => {
    document.body.innerHTML = `
      <table>
        <tbody class="arco-table-body">
          <tr class="arco-table-tr h-48">
            <td><input type="checkbox" value="101" /></td>
            <td><span>Episode 01.mkv</span></td>
          </tr>
        </tbody>
      </table>
    `;

    const adapter = new WKBrowserAdapter({ requestInterval: 0 });
    const result = await adapter.syncAfterRename([
      { fileId: '101', oldName: 'Episode 01.mkv', newName: 'Episode 01-fixed.mkv' },
    ]);

    expect(result.success).toBe(true);
    expect(result.method).toBe('dom-patch');
    const nameNode = document.querySelector<HTMLElement>('.arco-table-tr td:nth-child(2) span');
    expect(nameNode?.textContent).toBe('Episode 01-fixed.mkv');
  });
});
