import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { UCAdapter } from '../../../src/adapters/uc/uc-adapter';
import { getUCPageScriptInjector } from '../../../src/adapters/uc/page-script-injector';

vi.mock('../../../src/adapters/uc/page-script-injector', () => ({
  getUCPageScriptInjector: vi.fn(),
}));

describe('UCAdapter', () => {
  let adapter: UCAdapter;
  let mockFetch: Mock;
  let mockCallAPI: Mock;

  beforeEach(() => {
    adapter = new UCAdapter({ requestInterval: 0 });
    mockFetch = vi.fn();
    mockCallAPI = vi.fn();
    global.fetch = mockFetch;
    vi.mocked(getUCPageScriptInjector).mockReturnValue({
      callAPI: mockCallAPI,
    });

    Object.defineProperty(window, 'location', {
      value: {
        search: '',
        hash: '#/list/all/folder123-current-folder',
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('uses UC cloud drive API when fetching all files', async () => {
    mockFetch.mockResolvedValue({
      json: async () => ({
        code: 0,
        status: 200,
        message: 'success',
        data: {
          list: [
            {
              fid: 'file-1',
              file_name: 'Episode 01.mkv',
              pdir_fid: 'folder123',
              size: 1024,
              updated_at: 111,
              file: true,
              dir: false,
              format_type: 'video',
            },
          ],
        },
      }),
    });

    const files = await adapter.getAllFiles();

    expect(files).toEqual([
      {
        id: 'file-1',
        name: 'Episode 01.mkv',
        ext: '.mkv',
        parentId: 'folder123',
        size: 1024,
        mtime: 111,
      },
    ]);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('https://pc-api.uc.cn/1/clouddrive/file/sort'),
      expect.objectContaining({ method: 'GET', credentials: 'include' })
    );
    expect(mockFetch.mock.calls[0][0]).toContain('pr=UCBrowser');
    expect(mockFetch.mock.calls[0][0]).toContain('pdir_fid=folder123');
  });

  it('ignores header, directory, and invalid checked rows when collecting selected files', async () => {
    document.body.innerHTML = `
      <table>
        <thead>
          <tr><th><span class="ant-checkbox-checked"></span></th></tr>
        </thead>
        <tbody>
          <tr data-file-id="file-1" data-size="12" data-mtime="34">
            <td><span class="ant-checkbox-checked"></span></td>
            <td><span class="file-name">Episode 01.mkv</span></td>
          </tr>
          <tr data-is-dir="true" data-file-id="folder-1">
            <td><span class="ant-checkbox-checked"></span></td>
            <td><span class="file-name">Folder</span></td>
          </tr>
          <tr data-file-id="">
            <td><span class="ant-checkbox-checked"></span></td>
            <td><span class="file-name">Missing id.mkv</span></td>
          </tr>
          <tr data-file-id="file-2">
            <td><span class="ant-checkbox-checked"></span></td>
            <td><span class="file-name"></span></td>
          </tr>
        </tbody>
      </table>
      <div class="modal"><span class="ant-checkbox-checked"></span></div>
    `;

    const selectedFiles = await adapter.getSelectedFiles();

    expect(selectedFiles).toEqual([
      {
        id: 'file-1',
        name: 'Episode 01.mkv',
        ext: '.mkv',
        parentId: 'folder123',
        size: 12,
        mtime: 34,
      },
    ]);
  });

  it('shares one directory listing when checking multiple conflicts in the same folder', async () => {
    mockFetch.mockResolvedValue({
      json: async () => ({
        code: 0,
        status: 200,
        message: 'success',
        data: {
          list: [
            {
              fid: 'file-1',
              file_name: 'Episode 01.mkv',
              pdir_fid: 'folder123',
              size: 1024,
              updated_at: 111,
              file: true,
              dir: false,
              format_type: 'video',
            },
          ],
        },
      }),
    });

    const results = await Promise.all([
      adapter.checkNameConflict('Episode 01.mkv', 'folder123'),
      adapter.checkNameConflict('Episode 02.mkv', 'folder123'),
      adapter.checkNameConflict('Episode 03.mkv', 'folder123'),
    ]);

    expect(results).toEqual([true, false, false]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('patches visible UC rows after rename instead of reporting an unsupported sync failure', async () => {
    document.body.innerHTML = `
      <table>
        <tr data-file-id="file-1">
          <td><span class="file-name" title="Episode 01.mkv">Episode 01.mkv</span></td>
        </tr>
      </table>
    `;

    const result = await adapter.syncAfterRename([
      { fileId: 'file-1', oldName: 'Episode 01.mkv', newName: 'Episode 01-fixed.mkv' },
    ]);

    const nameNode = document.querySelector<HTMLElement>('.file-name');
    expect(result.success).toBe(true);
    expect(result.method).toBe('dom-patch');
    expect(nameNode?.textContent).toBe('Episode 01-fixed.mkv');
    expect(nameNode?.getAttribute('title')).toBe('Episode 01-fixed.mkv');
  });

  it('patches nested UC filename text without replacing native child structure', async () => {
    document.body.innerHTML = `
      <table>
        <tr data-file-id="file-1">
          <td>
            <span class="file-name" title="Episode 01.mkv">
              <span class="name-prefix">Episode 01</span><span class="name-ext">.mkv</span>
            </span>
          </td>
        </tr>
      </table>
    `;

    const result = await adapter.syncAfterRename([
      { fileId: 'file-1', oldName: 'Episode 01.mkv', newName: 'Episode 01-fixed.mkv' },
    ]);

    const nameNode = document.querySelector<HTMLElement>('.file-name');
    expect(result.success).toBe(true);
    expect(result.method).toBe('dom-patch');
    expect(nameNode?.querySelector('.name-prefix')).toBeTruthy();
    expect(nameNode?.querySelector('.name-ext')).toBeTruthy();
    expect(nameNode?.textContent?.replace(/\s+/g, '').trim()).toBe('Episode01-fixed.mkv');
    expect(nameNode?.getAttribute('title')).toBe('Episode 01-fixed.mkv');
  });

  it('uses UC cloud drive API when renaming a file', async () => {
    mockCallAPI.mockResolvedValue({
      code: 0,
      status: 200,
      message: 'success',
      data: {},
    });

    const result = await adapter.renameFile('file-1', 'Episode 01.sup');

    expect(result).toEqual({ success: true, newName: 'Episode 01.sup' });
    expect(mockCallAPI).toHaveBeenCalledWith(
      'POST',
      'https://pc-api.uc.cn/1/clouddrive/file/rename',
      {
        fid: 'file-1',
        file_name: 'Episode 01.sup',
        pdir_fid: 'folder123',
      },
      30000
    );
  });
});
