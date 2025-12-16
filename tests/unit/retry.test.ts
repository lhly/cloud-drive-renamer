import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renameWithRetry, isNetworkError, RetryConfig } from '../../src/core/retry';
import { PlatformAdapter, RenameResult } from '../../src/types/platform';

// Mock logger
vi.mock('../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock helpers
vi.mock('../../src/utils/helpers', () => ({
  sleep: vi.fn((ms) => Promise.resolve()),
}));

// Mock adapter
class MockAdapter implements Partial<PlatformAdapter> {
  renameCount = 0;
  shouldFail = false;
  failureError: Error | null = null;

  async renameFile(fileId: string, newName: string): Promise<RenameResult> {
    this.renameCount++;

    if (this.shouldFail && this.failureError) {
      throw this.failureError;
    }

    if (this.shouldFail) {
      return {
        success: false,
        error: this.failureError || new Error('Rename failed'),
      };
    }

    return {
      success: true,
      newName,
    };
  }

  getConfig() {
    return {
      platform: 'quark' as const,
      requestInterval: 800,
      maxRetries: 3,
    };
  }
}

describe('Retry Mechanism', () => {
  let adapter: MockAdapter;
  const retryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    showNotification: false, // 测试时不显示通知
  };

  beforeEach(() => {
    adapter = new MockAdapter();
    vi.clearAllMocks();
  });

  describe('isNetworkError', () => {
    it('应该识别网络错误', () => {
      expect(isNetworkError(new Error('network error'))).toBe(true);
      expect(isNetworkError(new Error('timeout error'))).toBe(true);
      expect(isNetworkError(new Error('fetch failed'))).toBe(true);
      expect(isNetworkError(new Error('connection refused'))).toBe(true);
      expect(isNetworkError(new Error('failed to fetch'))).toBe(true);
    });

    it('应该识别非网络错误', () => {
      expect(isNetworkError(new Error('permission denied'))).toBe(false);
      expect(isNetworkError(new Error('file not found'))).toBe(false);
      expect(isNetworkError(new Error('invalid name'))).toBe(false);
    });

    it('应该识别NetworkError类型', () => {
      const error = new Error('test');
      error.name = 'NetworkError';
      expect(isNetworkError(error)).toBe(true);
    });

    it('应该识别TimeoutError类型', () => {
      const error = new Error('test');
      error.name = 'TimeoutError';
      expect(isNetworkError(error)).toBe(true);
    });
  });

  describe('renameWithRetry', () => {
    it('第一次成功应该不重试', async () => {
      adapter.shouldFail = false;

      const result = await renameWithRetry(
        'file-1',
        'new-name.txt',
        adapter as PlatformAdapter,
        retryConfig
      );

      expect(result.success).toBe(true);
      expect(adapter.renameCount).toBe(1);
    });

    it('网络错误应该重试3次', async () => {
      adapter.shouldFail = true;
      adapter.failureError = new Error('network error');

      const result = await renameWithRetry(
        'file-1',
        'new-name.txt',
        adapter as PlatformAdapter,
        retryConfig
      );

      expect(result.success).toBe(false);
      expect(adapter.renameCount).toBe(3); // 初次 + 2次重试
    });

    it('非网络错误应该不重试', async () => {
      adapter.shouldFail = true;
      adapter.failureError = new Error('permission denied');

      const result = await renameWithRetry(
        'file-1',
        'new-name.txt',
        adapter as PlatformAdapter,
        retryConfig
      );

      expect(result.success).toBe(false);
      expect(adapter.renameCount).toBe(1); // 只尝试一次
    });

    it('第二次重试成功应该返回成功', async () => {
      adapter.shouldFail = true;
      adapter.failureError = new Error('network timeout');

      // 模拟第二次重试成功
      const originalRename = adapter.renameFile.bind(adapter);
      adapter.renameFile = async (fileId, newName) => {
        // 第一次失败，第二次成功（renameCount从0开始，第二次调用时renameCount=1）
        if (adapter.renameCount >= 1) {
          adapter.shouldFail = false;
        }
        return originalRename(fileId, newName);
      };

      const result = await renameWithRetry(
        'file-1',
        'new-name.txt',
        adapter as PlatformAdapter,
        retryConfig
      );

      expect(result.success).toBe(true);
      expect(adapter.renameCount).toBe(2); // 第二次成功（调用了2次）
    });

    it('应该使用指数退避策略', async () => {
      const { sleep } = await import('../../src/utils/helpers');

      adapter.shouldFail = true;
      adapter.failureError = new Error('network error');

      await renameWithRetry('file-1', 'new-name.txt', adapter as PlatformAdapter, retryConfig);

      // 检查sleep调用: 1s, 2s
      expect(sleep).toHaveBeenCalledWith(1000); // 第一次重试
      expect(sleep).toHaveBeenCalledWith(2000); // 第二次重试
    });

    it('应该返回最后一次错误', async () => {
      adapter.shouldFail = true;
      adapter.failureError = new Error('network timeout');

      const result = await renameWithRetry(
        'file-1',
        'new-name.txt',
        adapter as PlatformAdapter,
        retryConfig
      );

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('network');
    });

    it('应该支持自定义重试次数', async () => {
      adapter.shouldFail = true;
      adapter.failureError = new Error('network error');

      const customConfig: RetryConfig = {
        maxRetries: 5,
        baseDelay: 1000,
        showNotification: false,
      };

      await renameWithRetry('file-1', 'new-name.txt', adapter as PlatformAdapter, customConfig);

      expect(adapter.renameCount).toBe(5);
    });

    it('应该支持自定义延迟', async () => {
      const { sleep } = await import('../../src/utils/helpers');

      adapter.shouldFail = true;
      adapter.failureError = new Error('network error');

      const customConfig: RetryConfig = {
        maxRetries: 3,
        baseDelay: 2000,
        showNotification: false,
      };

      await renameWithRetry('file-1', 'new-name.txt', adapter as PlatformAdapter, customConfig);

      // 检查sleep调用: 2s, 4s
      expect(sleep).toHaveBeenCalledWith(2000);
      expect(sleep).toHaveBeenCalledWith(4000);
    });
  });
});
