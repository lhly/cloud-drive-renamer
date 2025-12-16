import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StorageManager, storage } from '../../src/utils/storage';

/**
 * Storage 模块单元测试
 *
 * 测试范围:
 * 1. chrome.storage.local的正常使用
 * 2. localStorage降级机制
 * 3. 所有CRUD操作
 * 4. 错误处理和降级
 */

describe('StorageManager', () => {
  let storageManager: StorageManager;
  let mockChromeStorage: any;
  let mockLocalStorage: Storage;

  beforeEach(() => {
    storageManager = new StorageManager();

    // Mock chrome.storage.local
    mockChromeStorage = {
      set: vi.fn((items) => Promise.resolve()),
      get: vi.fn((keys) => Promise.resolve({})),
      remove: vi.fn((keys) => Promise.resolve()),
      clear: vi.fn(() => Promise.resolve()),
    };

    // Mock chrome API
    global.chrome = {
      storage: {
        local: mockChromeStorage,
      },
    } as any;

    // Mock localStorage
    mockLocalStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    };
    global.localStorage = mockLocalStorage;

    // 清除console.error mock
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('set方法', () => {
    it('应该成功保存数据到chrome.storage.local', async () => {
      const key = 'test-key';
      const value = { data: 'test-value' };

      await storageManager.set(key, value);

      expect(mockChromeStorage.set).toHaveBeenCalledWith({ [key]: value });
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
    });

    it('应该在chrome.storage失败时降级到localStorage', async () => {
      const key = 'test-key';
      const value = { data: 'test-value' };

      // 模拟chrome.storage.set失败
      mockChromeStorage.set.mockRejectedValue(new Error('Chrome storage unavailable'));

      await storageManager.set(key, value);

      expect(mockChromeStorage.set).toHaveBeenCalledWith({ [key]: value });
      expect(console.error).toHaveBeenCalledWith(
        '[CDR] Failed to save to chrome.storage:',
        expect.any(Error)
      );
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(key, JSON.stringify(value));
    });

    it('应该正确处理不同数据类型', async () => {
      const testCases = [
        { key: 'string', value: 'simple string' },
        { key: 'number', value: 12345 },
        { key: 'boolean', value: true },
        { key: 'array', value: [1, 2, 3] },
        { key: 'object', value: { nested: { data: 'value' } } },
        { key: 'null', value: null },
      ];

      for (const { key, value } of testCases) {
        await storageManager.set(key, value);
        expect(mockChromeStorage.set).toHaveBeenCalledWith({ [key]: value });
      }
    });
  });

  describe('get方法', () => {
    it('应该成功从chrome.storage.local读取数据', async () => {
      const key = 'test-key';
      const value = { data: 'test-value' };

      mockChromeStorage.get.mockResolvedValue({ [key]: value });

      const result = await storageManager.get<any>(key);

      expect(mockChromeStorage.get).toHaveBeenCalledWith(key);
      expect(result).toEqual(value);
    });

    it('应该在数据不存在时返回null', async () => {
      const key = 'non-existent-key';

      mockChromeStorage.get.mockResolvedValue({});

      const result = await storageManager.get<any>(key);

      expect(result).toBeNull();
    });

    it('应该在chrome.storage失败时降级到localStorage', async () => {
      const key = 'test-key';
      const value = { data: 'test-value' };

      // 模拟chrome.storage.get失败
      mockChromeStorage.get.mockRejectedValue(new Error('Chrome storage unavailable'));
      (mockLocalStorage.getItem as any).mockReturnValue(JSON.stringify(value));

      const result = await storageManager.get<any>(key);

      expect(mockChromeStorage.get).toHaveBeenCalledWith(key);
      expect(console.error).toHaveBeenCalledWith(
        '[CDR] Failed to read from chrome.storage:',
        expect.any(Error)
      );
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith(key);
      expect(result).toEqual(value);
    });

    it('应该在localStorage数据不存在时返回null', async () => {
      const key = 'non-existent-key';

      mockChromeStorage.get.mockRejectedValue(new Error('Chrome storage unavailable'));
      (mockLocalStorage.getItem as any).mockReturnValue(null);

      const result = await storageManager.get<any>(key);

      expect(result).toBeNull();
    });

    it('应该正确处理复杂数据类型', async () => {
      const key = 'complex-data';
      const value = {
        user: {
          name: 'Test User',
          settings: {
            theme: 'dark',
            notifications: true,
          },
        },
        history: [1, 2, 3],
      };

      mockChromeStorage.get.mockResolvedValue({ [key]: value });

      const result = await storageManager.get<any>(key);

      expect(result).toEqual(value);
    });
  });

  describe('remove方法', () => {
    it('应该成功从chrome.storage.local删除数据', async () => {
      const key = 'test-key';

      await storageManager.remove(key);

      expect(mockChromeStorage.remove).toHaveBeenCalledWith(key);
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
    });

    it('应该在chrome.storage失败时降级到localStorage', async () => {
      const key = 'test-key';

      mockChromeStorage.remove.mockRejectedValue(new Error('Chrome storage unavailable'));

      await storageManager.remove(key);

      expect(mockChromeStorage.remove).toHaveBeenCalledWith(key);
      expect(console.error).toHaveBeenCalledWith(
        '[CDR] Failed to remove from chrome.storage:',
        expect.any(Error)
      );
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(key);
    });
  });

  describe('clear方法', () => {
    it('应该成功清空chrome.storage.local', async () => {
      await storageManager.clear();

      expect(mockChromeStorage.clear).toHaveBeenCalled();
      expect(mockLocalStorage.clear).not.toHaveBeenCalled();
    });

    it('应该在chrome.storage失败时降级到localStorage', async () => {
      mockChromeStorage.clear.mockRejectedValue(new Error('Chrome storage unavailable'));

      await storageManager.clear();

      expect(mockChromeStorage.clear).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        '[CDR] Failed to clear chrome.storage:',
        expect.any(Error)
      );
      expect(mockLocalStorage.clear).toHaveBeenCalled();
    });
  });

  describe('getAllKeys方法', () => {
    it('应该成功获取chrome.storage.local的所有键', async () => {
      const mockData = {
        'key1': 'value1',
        'key2': 'value2',
        'key3': 'value3',
      };

      mockChromeStorage.get.mockResolvedValue(mockData);

      const keys = await storageManager.getAllKeys();

      expect(mockChromeStorage.get).toHaveBeenCalledWith(null);
      expect(keys).toEqual(['key1', 'key2', 'key3']);
    });

    it('应该在chrome.storage失败时降级到localStorage', async () => {
      mockChromeStorage.get.mockRejectedValue(new Error('Chrome storage unavailable'));

      // Mock localStorage.keys
      Object.defineProperty(mockLocalStorage, 'length', { value: 2 });
      (mockLocalStorage.key as any)
        .mockReturnValueOnce('local-key1')
        .mockReturnValueOnce('local-key2');

      // 修改实现以匹配实际的getAllKeys逻辑
      const originalKeys = Object.keys;
      Object.keys = vi.fn((obj) => {
        if (obj === localStorage) {
          return ['local-key1', 'local-key2'];
        }
        return originalKeys(obj);
      });

      const keys = await storageManager.getAllKeys();

      expect(console.error).toHaveBeenCalledWith(
        '[CDR] Failed to get keys from chrome.storage:',
        expect.any(Error)
      );
      expect(keys).toEqual(['local-key1', 'local-key2']);

      Object.keys = originalKeys;
    });

    it('应该在没有数据时返回空数组', async () => {
      mockChromeStorage.get.mockResolvedValue({});

      const keys = await storageManager.getAllKeys();

      expect(keys).toEqual([]);
    });
  });

  describe('集成测试', () => {
    it('应该支持完整的CRUD操作流程', async () => {
      const key = 'integration-test';
      const value = { test: 'data', count: 123 };

      // Create
      await storageManager.set(key, value);
      expect(mockChromeStorage.set).toHaveBeenCalledWith({ [key]: value });

      // Read
      mockChromeStorage.get.mockResolvedValue({ [key]: value });
      const retrieved = await storageManager.get<any>(key);
      expect(retrieved).toEqual(value);

      // Update (通过set实现)
      const updatedValue = { test: 'updated', count: 456 };
      await storageManager.set(key, updatedValue);
      expect(mockChromeStorage.set).toHaveBeenCalledWith({ [key]: updatedValue });

      // Delete
      await storageManager.remove(key);
      expect(mockChromeStorage.remove).toHaveBeenCalledWith(key);
    });

    it('应该在混合使用chrome和localStorage时保持一致性', async () => {
      const key = 'mixed-test';
      const value = { data: 'test' };

      // 保存到chrome.storage成功
      await storageManager.set(key, value);
      expect(mockChromeStorage.set).toHaveBeenCalled();

      // chrome.storage读取失败，降级到localStorage
      mockChromeStorage.get.mockRejectedValue(new Error('Chrome unavailable'));
      (mockLocalStorage.getItem as any).mockReturnValue(JSON.stringify(value));

      const retrieved = await storageManager.get<any>(key);
      expect(retrieved).toEqual(value);
    });
  });

  describe('全局storage实例', () => {
    it('应该导出一个可用的全局storage实例', () => {
      expect(storage).toBeInstanceOf(StorageManager);
    });

    it('全局storage实例应该可以正常使用', async () => {
      const key = 'global-test';
      const value = 'test-value';

      await storage.set(key, value);
      expect(mockChromeStorage.set).toHaveBeenCalledWith({ [key]: value });
    });
  });
});
