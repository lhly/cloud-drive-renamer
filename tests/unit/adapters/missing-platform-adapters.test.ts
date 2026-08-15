import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { Drive115Adapter } from '../../../src/adapters/115/adapter';
import { Drive123Adapter } from '../../../src/adapters/123/adapter';
import { CMCCAdapter, md5 } from '../../../src/adapters/cmcc/adapter';
import { EsurfingAdapter } from '../../../src/adapters/esurfing/adapter';
import { XunleiAdapter } from '../../../src/adapters/xunlei/adapter';
import { getDrive115PageScriptInjector } from '../../../src/adapters/115/page-script-injector';
import { getDrive123PageScriptInjector } from '../../../src/adapters/123/page-script-injector';
import { getCMCCPageScriptInjector } from '../../../src/adapters/cmcc/page-script-injector';
import { CMCC_PAGE_SCRIPT_OPTIONS } from '../../../src/adapters/cmcc/page-script';
import { getEsurfingPageScriptInjector } from '../../../src/adapters/esurfing/page-script-injector';
import { getXunleiPageScriptInjector } from '../../../src/adapters/xunlei/page-script-injector';
import { XUNLEI_PAGE_SCRIPT_OPTIONS } from '../../../src/adapters/xunlei/page-script';

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

describe('missing platform adapters', () => {
  let mock115CallAPI: Mock;
  let mock123CallAPI: Mock;
  let mockCMCCCallAPI: Mock;
  let mockEsurfingCallAPI: Mock;
  let mockXunleiCallAPI: Mock;

  beforeEach(() => {
    mock115CallAPI = vi.fn();
    mock123CallAPI = vi.fn();
    mockCMCCCallAPI = vi.fn();
    mockEsurfingCallAPI = vi.fn();
    mockXunleiCallAPI = vi.fn();

    vi.mocked(getDrive115PageScriptInjector).mockReturnValue({ callAPI: mock115CallAPI });
    vi.mocked(getDrive123PageScriptInjector).mockReturnValue({ callAPI: mock123CallAPI });
    vi.mocked(getCMCCPageScriptInjector).mockReturnValue({ callAPI: mockCMCCCallAPI });
    vi.mocked(getEsurfingPageScriptInjector).mockReturnValue({ callAPI: mockEsurfingCallAPI });
    vi.mocked(getXunleiPageScriptInjector).mockReturnValue({ callAPI: mockXunleiCallAPI });

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
