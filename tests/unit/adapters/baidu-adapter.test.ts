import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BaiduAdapter } from '../../../src/adapters/baidu/baidu-adapter';

describe('BaiduAdapter', () => {
  let adapter: BaiduAdapter;
  let mockFetch: any;

  beforeEach(() => {
    adapter = new BaiduAdapter({ requestInterval: 0 });

    // Mock global fetch used by BasePlatformAdapter.fetchWithTimeout
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Avoid relying on MAIN-world injector in unit tests
    vi.spyOn(adapter as any, 'extractBdstoken').mockResolvedValue('mock-token');
    vi.spyOn(adapter as any, 'rateLimit').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAllFiles', () => {
    it('应该支持 /api/list 顶层 list 响应结构（errno=0）', async () => {
      mockFetch.mockResolvedValue({
        json: async () => ({
          errno: 0,
          list: [
            {
              path: '/test/a.txt',
              server_filename: 'a.txt',
              fs_id: 1,
              md5: 'x',
              isdir: 0,
              size: 10,
              server_mtime: 1700000000,
            },
            {
              path: '/test/folder',
              server_filename: 'folder',
              fs_id: 2,
              md5: 'y',
              isdir: 1,
              size: 0,
              server_mtime: 1700000001,
            },
          ],
        }),
      });

      const files = await adapter.getAllFiles('/test');

      expect(files).toHaveLength(1);
      expect(files[0]).toEqual({
        id: '1',
        name: 'a.txt',
        ext: '.txt',
        parentId: '/test',
        size: 10,
        mtime: 1700000000 * 1000,
      });
    });
  });
});

