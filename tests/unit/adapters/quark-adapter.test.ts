import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QuarkAdapter } from '../../../src/adapters/quark/quark';
import { QuarkAPIError, isRetryableError, getErrorMessage } from '../../../src/adapters/quark/errors';
import { FileItem } from '../../../src/types/platform';

/**
 * QuarkAdapter 单元测试
 *
 * 测试范围:
 * 1. DOM交互 (getSelectedFiles, getFileInfo)
 * 2. API调用 (renameFile, checkNameConflict)
 * 3. 速率限制机制 (rateLimit)
 * 4. 重试机制 (retryableRequest)
 * 5. 错误处理 (QuarkAPIError)
 */

// Mock helpers
vi.mock('../../../src/utils/helpers', () => ({
  parseFileName: (fileName: string) => {
    const lastDot = fileName.lastIndexOf('.');
    if (lastDot === -1) {
      return { name: fileName, ext: '' };
    }
    return {
      name: fileName.substring(0, lastDot),
      ext: fileName.substring(lastDot),
    };
  },
}));

describe('QuarkAdapter', () => {
  let adapter: QuarkAdapter;
  let mockFetch: any;

  beforeEach(() => {
    adapter = new QuarkAdapter();

    // Mock global fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Mock console methods
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        search: '?dir_id=test-dir-123',
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('getSelectedFiles方法', () => {
    it('应该返回空数组当没有选中文件时', async () => {
      document.body.innerHTML = '<div></div>';

      const files = await adapter.getSelectedFiles();

      expect(files).toEqual([]);
    });

    it('应该正确提取选中的文件信息', async () => {
      document.body.innerHTML = `
        <table>
          <tr data-file-id="file-1" data-size="1024" data-mtime="1639584000000">
            <td class="ant-checkbox-checked"></td>
            <td class="file-name">document.pdf</td>
          </tr>
          <tr data-file-id="file-2" data-size="2048" data-mtime="1639584001000">
            <td class="ant-checkbox-checked"></td>
            <td class="file-name">photo.jpg</td>
          </tr>
        </table>
      `;

      const files = await adapter.getSelectedFiles();

      expect(files).toHaveLength(2);
      expect(files[0]).toEqual({
        id: 'file-1',
        name: 'document.pdf',
        ext: '.pdf',
        parentId: 'test-dir-123',
        size: 1024,
        mtime: 1639584000000,
      });
      expect(files[1]).toEqual({
        id: 'file-2',
        name: 'photo.jpg',
        ext: '.jpg',
        parentId: 'test-dir-123',
        size: 2048,
        mtime: 1639584001000,
      });
    });

    it('应该过滤掉文件夹，只返回文件', async () => {
      document.body.innerHTML = `
        <table>
          <tr data-file-id="file-1" data-size="1024" data-mtime="1639584000000" class="is-directory">
            <td class="ant-checkbox-checked"></td>
            <td class="file-name">folder</td>
          </tr>
          <tr data-file-id="file-2" data-size="2048" data-mtime="1639584001000">
            <td class="ant-checkbox-checked"></td>
            <td class="file-name">file.txt</td>
          </tr>
          <tr data-file-id="file-3" data-size="3072" data-mtime="1639584002000" data-is-dir="true">
            <td class="ant-checkbox-checked"></td>
            <td class="file-name">another-folder</td>
          </tr>
        </table>
      `;

      const files = await adapter.getSelectedFiles();

      expect(files).toHaveLength(1);
      expect(files[0].id).toBe('file-2');
      expect(files[0].name).toBe('file.txt');
    });

    it('应该处理缺失的属性', async () => {
      document.body.innerHTML = `
        <table>
          <tr data-file-id="file-1">
            <td class="ant-checkbox-checked"></td>
            <td class="file-name">test.txt</td>
          </tr>
        </table>
      `;

      const files = await adapter.getSelectedFiles();

      expect(files).toHaveLength(1);
      expect(files[0].size).toBe(0);
      expect(files[0].mtime).toBeGreaterThan(Date.now() - 1000);
    });

    it('应该处理无扩展名的文件', async () => {
      document.body.innerHTML = `
        <table>
          <tr data-file-id="file-1" data-size="1024" data-mtime="1639584000000">
            <td class="ant-checkbox-checked"></td>
            <td class="file-name">README</td>
          </tr>
        </table>
      `;

      const files = await adapter.getSelectedFiles();

      expect(files[0].ext).toBe('');
    });

    it('应该在DOM解析失败时抛出错误', async () => {
      // 保存原始的querySelectorAll
      const originalQuerySelectorAll = document.querySelectorAll;

      // 模拟一个会导致错误的DOM结构
      Object.defineProperty(document, 'querySelectorAll', {
        value: () => {
          throw new Error('DOM parsing error');
        },
        writable: true,
        configurable: true,
      });

      await expect(adapter.getSelectedFiles()).rejects.toThrow('获取选中文件失败');

      // 恢复原始的querySelectorAll
      Object.defineProperty(document, 'querySelectorAll', {
        value: originalQuerySelectorAll,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('getAllFiles方法', () => {
    it('应该返回当前目录下的文件和文件夹', async () => {
      // Avoid real 800ms rate limiting delay in unit test
      vi.spyOn(adapter as any, 'rateLimit').mockResolvedValue(undefined);

      Object.defineProperty(window, 'location', {
        value: {
          search: '',
          hash: '#/list/folder/12345',
        },
        writable: true,
      });

      mockFetch.mockResolvedValue({
        json: async () => ({
          status: 200,
          code: 0,
          message: 'success',
          timestamp: Date.now(),
          data: {
            list: [
              {
                fid: 'file-1',
                file_name: 'a.txt',
                pdir_fid: '12345',
                size: 10,
                updated_at: 111,
                file: true,
                dir: false,
              },
              {
                fid: 'dir-1',
                file_name: 'folderA',
                pdir_fid: '12345',
                size: 0,
                updated_at: 222,
                file: false,
                dir: true,
              },
            ],
          },
        }),
      });

      const files = await adapter.getAllFiles();

      expect(files).toEqual([
        {
          id: 'file-1',
          name: 'a.txt',
          ext: '.txt',
          parentId: '12345',
          size: 10,
          mtime: 111,
        },
        {
          id: 'dir-1',
          name: 'folderA',
          ext: '',
          parentId: '12345',
          size: 0,
          mtime: 222,
        },
      ]);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('pdir_fid=12345'),
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        })
      );
    });
  });

  describe('renameFile方法', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('应该成功重命名文件', async () => {
      const mockResponse = {
        status: 200,
        code: 0,
        message: 'success',
        timestamp: Date.now(),
        data: {},
      };

      mockFetch.mockResolvedValue({
        json: async () => mockResponse,
      });

      const resultPromise = adapter.renameFile('file-123', 'new-name.txt');

      // 快进时间以满足速率限制
      await vi.runAllTimersAsync();

      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.newName).toBe('new-name.txt');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://drive-pc.quark.cn/1/clouddrive/file/rename',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            fid: 'file-123',
            file_name: 'new-name.txt',
          }),
        })
      );
    });

    it('应该处理API错误响应', async () => {
      const mockResponse = {
        status: 400,
        code: 1002,
        message: '文件名非法',
        timestamp: Date.now(),
        data: null,
      };

      mockFetch.mockResolvedValue({
        json: async () => mockResponse,
      });

      const resultPromise = adapter.renameFile('file-123', 'invalid<>name.txt');
      await vi.runAllTimersAsync();

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(QuarkAPIError);
    });

    it('应该对网络错误进行重试', async () => {
      // Mock both sleep and rateLimit to avoid timing issues
      vi.spyOn(adapter as any, 'sleep').mockResolvedValue(undefined);
      vi.spyOn(adapter as any, 'rateLimit').mockResolvedValue(undefined);

      let attemptCount = 0;
      mockFetch.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          // 使用TypeError with 'fetch'来触发重试逻辑
          return Promise.reject(new TypeError('fetch failed'));
        }
        return Promise.resolve({
          json: async () => ({
            status: 200,
            code: 0,
            message: 'success',
            timestamp: Date.now(),
            data: {},
          }),
        });
      });

      const result = await adapter.renameFile('file-123', 'new-name.txt');

      expect(result.success).toBe(true);
      expect(attemptCount).toBe(3); // 确认重试了3次
    });

    it('应该在达到最大重试次数后返回失败', async () => {
      // Mock both sleep and rateLimit to avoid timing issues
      vi.spyOn(adapter as any, 'sleep').mockResolvedValue(undefined);
      vi.spyOn(adapter as any, 'rateLimit').mockResolvedValue(undefined);

      // 使用TypeError with 'fetch'来触发重试逻辑
      mockFetch.mockRejectedValue(new TypeError('fetch failed'));

      const result = await adapter.renameFile('file-123', 'new-name.txt');

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(mockFetch).toHaveBeenCalledTimes(3); // maxRetries = 3
    });

    it('应该遵守速率限制', async () => {
      mockFetch.mockResolvedValue({
        json: async () => ({
          status: 200,
          code: 0,
          message: 'success',
          timestamp: Date.now(),
          data: {},
        }),
      });

      const startTime = Date.now();

      // 连续发起两个请求
      const promise1 = adapter.renameFile('file-1', 'name1.txt');
      await vi.runAllTimersAsync();
      await promise1;

      const promise2 = adapter.renameFile('file-2', 'name2.txt');
      await vi.runAllTimersAsync();
      await promise2;

      const elapsed = Date.now() - startTime;

      // 两次请求之间应该至少间隔800ms
      expect(elapsed).toBeGreaterThanOrEqual(0); // 由于使用fake timers，实际时间不会流逝
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('应该对超时错误进行重试', async () => {
      vi.spyOn(adapter as any, 'sleep').mockResolvedValue(undefined);
      vi.spyOn(adapter as any, 'rateLimit').mockResolvedValue(undefined);

      let attemptCount = 0;
      mockFetch.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 2) {
          const error = new Error('Request timeout');
          error.name = 'AbortError';
          return Promise.reject(error);
        }
        return Promise.resolve({
          json: async () => ({
            status: 200,
            code: 0,
            message: 'success',
            timestamp: Date.now(),
            data: {},
          }),
        });
      });

      const result = await adapter.renameFile('file-123', 'new-name.txt');

      expect(result.success).toBe(true);
      expect(attemptCount).toBe(2);
    });

    it('应该对429限流错误进行重试', async () => {
      vi.spyOn(adapter as any, 'sleep').mockResolvedValue(undefined);
      vi.spyOn(adapter as any, 'rateLimit').mockResolvedValue(undefined);

      let attemptCount = 0;
      mockFetch.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 2) {
          return Promise.reject(new QuarkAPIError(429, '请求过于频繁'));
        }
        return Promise.resolve({
          json: async () => ({
            status: 200,
            code: 0,
            message: 'success',
            timestamp: Date.now(),
            data: {},
          }),
        });
      });

      const result = await adapter.renameFile('file-123', 'new-name.txt');

      expect(result.success).toBe(true);
      expect(attemptCount).toBe(2);
    });

    it('应该对500服务器错误进行重试', async () => {
      vi.spyOn(adapter as any, 'sleep').mockResolvedValue(undefined);
      vi.spyOn(adapter as any, 'rateLimit').mockResolvedValue(undefined);

      let attemptCount = 0;
      mockFetch.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 2) {
          return Promise.reject(new QuarkAPIError(500, '服务器内部错误'));
        }
        return Promise.resolve({
          json: async () => ({
            status: 200,
            code: 0,
            message: 'success',
            timestamp: Date.now(),
            data: {},
          }),
        });
      });

      const result = await adapter.renameFile('file-123', 'new-name.txt');

      expect(result.success).toBe(true);
      expect(attemptCount).toBe(2);
    });

    it('应该不对不可重试错误进行重试', async () => {
      vi.spyOn(adapter as any, 'sleep').mockResolvedValue(undefined);
      vi.spyOn(adapter as any, 'rateLimit').mockResolvedValue(undefined);

      let attemptCount = 0;
      mockFetch.mockImplementation(() => {
        attemptCount++;
        return Promise.reject(new QuarkAPIError(403, '无权限访问'));
      });

      const result = await adapter.renameFile('file-123', 'new-name.txt');

      expect(result.success).toBe(false);
      expect(attemptCount).toBe(1); // 不应该重试
    });
  });

  describe('checkNameConflict方法', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('应该检测到文件名冲突', async () => {
      mockFetch.mockResolvedValue({
        json: async () => ({
          status: 200,
          code: 0,
          message: 'success',
          timestamp: Date.now(),
          data: {
            list: [
              { fid: 'file-1', file_name: 'existing.txt' },
              { fid: 'file-2', file_name: 'another.txt' },
            ],
          },
        }),
      });

      const resultPromise = adapter.checkNameConflict('existing.txt', 'parent-123');
      await vi.runAllTimersAsync();
      const hasConflict = await resultPromise;

      expect(hasConflict).toBe(true);
    });

    it('应该返回false当文件名不冲突', async () => {
      mockFetch.mockResolvedValue({
        json: async () => ({
          status: 200,
          code: 0,
          message: 'success',
          timestamp: Date.now(),
          data: {
            list: [
              { fid: 'file-1', file_name: 'existing.txt' },
              { fid: 'file-2', file_name: 'another.txt' },
            ],
          },
        }),
      });

      const resultPromise = adapter.checkNameConflict('new-file.txt', 'parent-123');
      await vi.runAllTimersAsync();
      const hasConflict = await resultPromise;

      expect(hasConflict).toBe(false);
    });

    it('应该在API失败时保守返回true', async () => {
      mockFetch.mockRejectedValue(new Error('API error'));

      const resultPromise = adapter.checkNameConflict('test.txt', 'parent-123');
      await vi.runAllTimersAsync();
      const hasConflict = await resultPromise;

      expect(hasConflict).toBe(true);
      expect(console.error).toHaveBeenCalled();
    });

    it('应该在API返回非0状态码时返回false', async () => {
      mockFetch.mockResolvedValue({
        json: async () => ({
          status: 400,
          code: 1001,
          message: 'Bad request',
          timestamp: Date.now(),
          data: null,
        }),
      });

      const resultPromise = adapter.checkNameConflict('test.txt', 'parent-123');
      await vi.runAllTimersAsync();
      const hasConflict = await resultPromise;

      expect(hasConflict).toBe(false);
    });

    it('应该在API返回空list时返回false', async () => {
      mockFetch.mockResolvedValue({
        json: async () => ({
          status: 200,
          code: 0,
          message: 'success',
          timestamp: Date.now(),
          data: {
            list: null,
          },
        }),
      });

      const resultPromise = adapter.checkNameConflict('test.txt', 'parent-123');
      await vi.runAllTimersAsync();
      const hasConflict = await resultPromise;

      expect(hasConflict).toBe(false);
    });

    it('应该正确构建API请求URL', async () => {
      mockFetch.mockResolvedValue({
        json: async () => ({
          status: 200,
          code: 0,
          data: { list: [] },
        }),
      });

      const resultPromise = adapter.checkNameConflict('test.txt', 'parent-456');
      await vi.runAllTimersAsync();
      await resultPromise;

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain('pdir_fid=parent-456');
      expect(callUrl).toContain('_page=1');
      expect(callUrl).toContain('_size=100');
    });
  });

  describe('getFileInfo方法', () => {
    it('应该从DOM中获取文件信息', async () => {
      document.body.innerHTML = `
        <table>
          <tr data-file-id="file-789" data-size="4096" data-mtime="1639584000000">
            <td class="file-name">report.docx</td>
          </tr>
        </table>
      `;

      const fileInfo = await adapter.getFileInfo('file-789');

      expect(fileInfo).toEqual({
        id: 'file-789',
        name: 'report.docx',
        ext: '.docx',
        parentId: 'test-dir-123',
        size: 4096,
        mtime: 1639584000000,
      });
    });

    it('应该在文件不存在时抛出错误', async () => {
      document.body.innerHTML = '<div></div>';

      await expect(adapter.getFileInfo('non-existent')).rejects.toThrow(
        '找不到文件 ID: non-existent'
      );
    });

    it('应该处理缺失的size和mtime属性', async () => {
      document.body.innerHTML = `
        <table>
          <tr data-file-id="file-999">
            <td class="file-name">test.txt</td>
          </tr>
        </table>
      `;

      const fileInfo = await adapter.getFileInfo('file-999');

      expect(fileInfo.size).toBe(0);
      expect(fileInfo.mtime).toBeGreaterThan(Date.now() - 1000);
    });
  });

  describe('getCurrentFolderId私有方法', () => {
    it('应该从URL参数中提取dir_id', async () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?dir_id=url-dir-123',
        },
        writable: true,
      });

      document.body.innerHTML = `
        <table>
          <tr data-file-id="file-1" data-size="1024" data-mtime="1639584000000">
            <td class="ant-checkbox-checked"></td>
            <td class="file-name">test.txt</td>
          </tr>
        </table>
      `;

      const files = await adapter.getSelectedFiles();
      expect(files).toHaveLength(1);
      expect(files[0].parentId).toBe('url-dir-123');
    });

    it('应该从URL参数中提取pdir_fid', async () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?pdir_fid=pdir-456',
        },
        writable: true,
      });

      document.body.innerHTML = `
        <table>
          <tr data-file-id="file-1" data-size="1024" data-mtime="1639584000000">
            <td class="ant-checkbox-checked"></td>
            <td class="file-name">test.txt</td>
          </tr>
        </table>
      `;

      const files = await adapter.getSelectedFiles();
      expect(files).toHaveLength(1);
      expect(files[0].parentId).toBe('pdir-456');
    });

    it('应该从DOM中提取dir_id', async () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '',
        },
        writable: true,
      });

      document.body.innerHTML = `
        <div data-dir-id="dom-dir-789"></div>
        <table>
          <tr data-file-id="file-1" data-size="1024" data-mtime="1639584000000">
            <td class="ant-checkbox-checked"></td>
            <td class="file-name">test.txt</td>
          </tr>
        </table>
      `;

      const files = await adapter.getSelectedFiles();
      expect(files).toHaveLength(1);
      expect(files[0].parentId).toBe('dom-dir-789');
    });

    it('应该在无法获取dir_id时返回默认值0', async () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '',
        },
        writable: true,
      });

      document.body.innerHTML = `
        <table>
          <tr data-file-id="file-1" data-size="1024" data-mtime="1639584000000">
            <td class="ant-checkbox-checked"></td>
            <td class="file-name">test.txt</td>
          </tr>
        </table>
      `;

      const files = await adapter.getSelectedFiles();
      expect(files).toHaveLength(1);
      expect(files[0].parentId).toBe('0');
    });

    it('应该从URL hash中提取folder路径的目录ID', async () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '',
          hash: '#/list/folder/12345',
        },
        writable: true,
      });

      document.body.innerHTML = `
        <table>
          <tr data-file-id="file-1" data-size="1024" data-mtime="1639584000000">
            <td class="ant-checkbox-checked"></td>
            <td class="file-name">test.txt</td>
          </tr>
        </table>
      `;

      const files = await adapter.getSelectedFiles();
      expect(files).toHaveLength(1);
      expect(files[0].parentId).toBe('12345');
    });

    it('应该从URL hash中提取all路径的目录ID并去掉后缀', async () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '',
          hash: '#/list/all/98765-extra-info',
        },
        writable: true,
      });

      document.body.innerHTML = `
        <table>
          <tr data-file-id="file-1" data-size="1024" data-mtime="1639584000000">
            <td class="ant-checkbox-checked"></td>
            <td class="file-name">test.txt</td>
          </tr>
        </table>
      `;

      const files = await adapter.getSelectedFiles();
      expect(files).toHaveLength(1);
      expect(files[0].parentId).toBe('98765');
    });
  });

  describe('配置和平台属性', () => {
    it('应该正确设置平台名称', () => {
      expect(adapter.platform).toBe('quark');
    });

    it('应该使用正确的默认配置', () => {
      const config = adapter.getConfig();

      expect(config.platform).toBe('quark');
      expect(config.requestInterval).toBe(800);
      expect(config.maxRetries).toBe(3);
      expect(config.timeout).toBe(30000);
    });

    it('应该支持自定义配置', () => {
      const customAdapter = new QuarkAdapter({
        requestInterval: 1000,
        maxRetries: 5,
      });

      const config = customAdapter.getConfig();

      expect(config.requestInterval).toBe(1000);
      expect(config.maxRetries).toBe(5);
    });

    it('应该使用正确的baseURL', async () => {
      // 通过检查fetch调用来验证baseURL
      mockFetch.mockResolvedValue({
        json: async () => ({
          status: 200,
          code: 0,
          data: {},
        }),
      });

      vi.useFakeTimers();
      const promise = adapter.renameFile('file-1', 'test.txt');
      await vi.advanceTimersByTimeAsync(1000);
      await promise;
      vi.useRealTimers();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://drive-pc.quark.cn/1/clouddrive'),
        expect.any(Object)
      );
    });
  });
});

describe('QuarkAPIError', () => {
  it('应该正确创建错误实例', () => {
    const error = new QuarkAPIError(404, '文件不存在', { extra: 'data' });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('QuarkAPIError');
    expect(error.message).toBe('文件不存在');
    expect(error.code).toBe(404);
    expect(error.response).toEqual({ extra: 'data' });
  });

  it('应该支持标准Error特性', () => {
    const error = new QuarkAPIError(500, '服务器错误');

    expect(error.toString()).toContain('QuarkAPIError');
    expect(error.stack).toBeDefined();
  });
});

describe('isRetryableError辅助函数', () => {
  it('应该识别网络错误为可重试', () => {
    const error = new TypeError('Failed to fetch');
    expect(isRetryableError(error)).toBe(true);
  });

  it('应该识别超时错误为可重试', () => {
    const error = new Error('timeout');
    error.name = 'AbortError';
    expect(isRetryableError(error)).toBe(true);
  });

  it('应该识别429限流错误为可重试', () => {
    const error = new QuarkAPIError(429, '请求过于频繁');
    expect(isRetryableError(error)).toBe(true);
  });

  it('应该识别500服务器错误为可重试', () => {
    const error = new QuarkAPIError(500, '服务器内部错误');
    expect(isRetryableError(error)).toBe(true);
  });

  it('应该识别404错误为不可重试', () => {
    const error = new QuarkAPIError(404, '文件不存在');
    expect(isRetryableError(error)).toBe(false);
  });

  it('应该识别403权限错误为不可重试', () => {
    const error = new QuarkAPIError(403, '无权限访问');
    expect(isRetryableError(error)).toBe(false);
  });

  it('应该识别普通错误为不可重试', () => {
    const error = new Error('Some other error');
    expect(isRetryableError(error)).toBe(false);
  });
});

describe('getErrorMessage辅助函数', () => {
  it('应该返回已知错误码的消息', () => {
    expect(getErrorMessage(0)).toBe('成功');
    expect(getErrorMessage(401)).toBe('未登录或认证失败');
    expect(getErrorMessage(403)).toBe('无权限访问');
    expect(getErrorMessage(404)).toBe('文件不存在');
    expect(getErrorMessage(409)).toBe('文件名冲突');
    expect(getErrorMessage(429)).toBe('请求过于频繁');
    expect(getErrorMessage(500)).toBe('服务器内部错误');
    expect(getErrorMessage(1001)).toBe('参数错误');
    expect(getErrorMessage(1002)).toBe('文件名非法');
    expect(getErrorMessage(1003)).toBe('文件已存在');
  });

  it('应该使用defaultMessage作为未知错误码的消息', () => {
    expect(getErrorMessage(9999, '自定义错误消息')).toBe('自定义错误消息');
  });

  it('应该返回"未知错误"当没有defaultMessage时', () => {
    expect(getErrorMessage(9999)).toBe('未知错误');
  });
});
