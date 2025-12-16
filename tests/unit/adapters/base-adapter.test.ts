import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BasePlatformAdapter } from '../../../src/adapters/base/adapter.interface';
import { PlatformName, FileItem, RenameResult, PlatformConfig } from '../../../src/types/platform';

/**
 * BasePlatformAdapter 单元测试
 *
 * 测试范围:
 * 1. 配置管理 (constructor, getConfig)
 * 2. 工具方法 (extractExtension, sleep, fetchWithTimeout)
 * 3. 子类实现要求 (抽象方法)
 */

// 创建具体的测试适配器类
class TestAdapter extends BasePlatformAdapter {
  readonly platform: PlatformName = 'quark';

  async getSelectedFiles(): Promise<FileItem[]> {
    return [];
  }

  async renameFile(fileId: string, newName: string): Promise<RenameResult> {
    return { success: true, newName };
  }

  async checkNameConflict(fileName: string, parentId: string): Promise<boolean> {
    return false;
  }

  async getFileInfo(fileId: string): Promise<FileItem> {
    return {
      id: fileId,
      name: 'test.txt',
      ext: '.txt',
      parentId: '0',
      size: 1024,
      mtime: Date.now(),
    };
  }

  // 暴露protected方法用于测试
  public testExtractExtension(fileName: string): string {
    return this.extractExtension(fileName);
  }

  public testSleep(ms: number): Promise<void> {
    return this.sleep(ms);
  }

  public testFetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
    return this.fetchWithTimeout(url, options);
  }

  public getProtectedConfig(): PlatformConfig {
    return this.config;
  }
}

describe('BasePlatformAdapter', () => {
  let adapter: TestAdapter;

  beforeEach(() => {
    adapter = new TestAdapter({});
  });

  describe('构造函数和配置管理', () => {
    it('应该使用默认配置创建实例', () => {
      const config = adapter.getConfig();

      expect(config.platform).toBe('quark');
      expect(config.requestInterval).toBe(800);
      expect(config.maxRetries).toBe(3);
      expect(config.timeout).toBe(30000);
    });

    it('应该支持部分配置覆盖', () => {
      const customAdapter = new TestAdapter({
        requestInterval: 1000,
        maxRetries: 5,
      });

      const config = customAdapter.getConfig();

      expect(config.platform).toBe('quark');
      expect(config.requestInterval).toBe(1000);
      expect(config.maxRetries).toBe(5);
      expect(config.timeout).toBe(30000); // 保持默认值
    });

    it('应该支持完全自定义配置', () => {
      const customConfig = {
        platform: 'aliyun' as PlatformName,
        requestInterval: 1500,
        maxRetries: 10,
        timeout: 60000,
      };

      const customAdapter = new TestAdapter(customConfig);
      const config = customAdapter.getConfig();

      expect(config).toEqual(customConfig);
    });

    it('getConfig应该返回配置对象', () => {
      const config = adapter.getConfig();

      expect(config).toBeDefined();
      expect(config).toHaveProperty('platform');
      expect(config).toHaveProperty('requestInterval');
      expect(config).toHaveProperty('maxRetries');
      expect(config).toHaveProperty('timeout');
    });
  });

  describe('extractExtension方法', () => {
    it('应该正确提取常见文件扩展名', () => {
      expect(adapter.testExtractExtension('test.txt')).toBe('.txt');
      expect(adapter.testExtractExtension('photo.jpg')).toBe('.jpg');
      expect(adapter.testExtractExtension('document.pdf')).toBe('.pdf');
      expect(adapter.testExtractExtension('archive.zip')).toBe('.zip');
    });

    it('应该正确处理多个点的文件名', () => {
      expect(adapter.testExtractExtension('file.name.with.dots.txt')).toBe('.txt');
      expect(adapter.testExtractExtension('archive.tar.gz')).toBe('.gz');
      expect(adapter.testExtractExtension('version.2.0.1.txt')).toBe('.txt');
    });

    it('应该对没有扩展名的文件返回空字符串', () => {
      expect(adapter.testExtractExtension('README')).toBe('');
      expect(adapter.testExtractExtension('Makefile')).toBe('');
      expect(adapter.testExtractExtension('noextension')).toBe('');
    });

    it('应该正确处理以点结尾的文件名', () => {
      expect(adapter.testExtractExtension('file.')).toBe('');
      expect(adapter.testExtractExtension('test.txt.')).toBe('');
    });

    it('应该正确处理以点开头的隐藏文件', () => {
      expect(adapter.testExtractExtension('.gitignore')).toBe('');
      expect(adapter.testExtractExtension('.env.local')).toBe('.local');
      expect(adapter.testExtractExtension('.config')).toBe('');
    });

    it('应该处理空字符串和特殊情况', () => {
      expect(adapter.testExtractExtension('')).toBe('');
      expect(adapter.testExtractExtension('.')).toBe('');
      expect(adapter.testExtractExtension('..')).toBe('');
    });

    it('应该保留扩展名的大小写', () => {
      expect(adapter.testExtractExtension('Photo.JPG')).toBe('.JPG');
      expect(adapter.testExtractExtension('Document.PDF')).toBe('.PDF');
      expect(adapter.testExtractExtension('file.TxT')).toBe('.TxT');
    });
  });

  describe('sleep方法', () => {
    it('应该按指定时间延迟执行', async () => {
      const startTime = Date.now();
      const delay = 100;

      await adapter.testSleep(delay);

      const elapsedTime = Date.now() - startTime;
      // 允许±20ms的误差
      expect(elapsedTime).toBeGreaterThanOrEqual(delay - 20);
      expect(elapsedTime).toBeLessThan(delay + 50);
    });

    it('应该支持0ms延迟', async () => {
      const startTime = Date.now();

      await adapter.testSleep(0);

      const elapsedTime = Date.now() - startTime;
      // 0ms延迟应该几乎立即完成
      expect(elapsedTime).toBeLessThan(20);
    });

    it('应该返回Promise', () => {
      const result = adapter.testSleep(10);
      expect(result).toBeInstanceOf(Promise);
    });

    it('应该支持链式调用', async () => {
      const startTime = Date.now();

      await adapter.testSleep(50).then(() => adapter.testSleep(50));

      const elapsedTime = Date.now() - startTime;
      expect(elapsedTime).toBeGreaterThanOrEqual(90);
    });
  });

  describe('fetchWithTimeout方法', () => {
    beforeEach(() => {
      // Mock global fetch
      global.fetch = vi.fn();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.restoreAllMocks();
      vi.useRealTimers();
    });

    it('应该成功执行fetch请求', async () => {
      const mockResponse = new Response('success', { status: 200 });
      (global.fetch as any).mockResolvedValue(mockResponse);

      const promise = adapter.testFetchWithTimeout('https://example.com/api');

      // 快进所有定时器
      await vi.runAllTimersAsync();

      const response = await promise;

      expect(fetch).toHaveBeenCalledWith('https://example.com/api', expect.objectContaining({
        signal: expect.any(AbortSignal),
      }));
      expect(response).toBe(mockResponse);
    });

    it('应该传递fetch选项', async () => {
      const mockResponse = new Response('success', { status: 200 });
      (global.fetch as any).mockResolvedValue(mockResponse);

      const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' }),
      };

      const promise = adapter.testFetchWithTimeout('https://example.com/api', options);
      await vi.runAllTimersAsync();
      await promise;

      expect(fetch).toHaveBeenCalledWith(
        'https://example.com/api',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: 'data' }),
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('应该在超时时中断请求', async () => {
      // 验证Ab ortSignal被正确传递给fetch
      let capturedSignal: AbortSignal | undefined;

      (global.fetch as any).mockImplementation(
        (url: string, options: any) => {
          capturedSignal = options?.signal;
          return Promise.resolve(new Response('success', { status: 200 }));
        }
      );

      const customAdapter = new TestAdapter({ timeout: 1000 });
      await customAdapter.testFetchWithTimeout('https://example.com/api');

      // 验证AbortSignal被正确传递
      expect(capturedSignal).toBeDefined();
      expect(capturedSignal).toBeInstanceOf(AbortSignal);
    });

    it('应该使用配置的超时时间', async () => {
      const customTimeout = 5000;
      const customAdapter = new TestAdapter({ timeout: customTimeout });

      // 验证配置被正确使用
      const config = customAdapter.getConfig();
      expect(config.timeout).toBe(customTimeout);

      // 验证fetchWithTimeout使用这个配置
      (global.fetch as any).mockResolvedValue(new Response('success', { status: 200 }));

      await customAdapter.testFetchWithTimeout('https://example.com/api');

      expect(fetch).toHaveBeenCalledWith(
        'https://example.com/api',
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('应该在请求成功后清除超时定时器', async () => {
      const mockResponse = new Response('success', { status: 200 });
      (global.fetch as any).mockResolvedValue(mockResponse);

      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const promise = adapter.testFetchWithTimeout('https://example.com/api');
      await vi.runAllTimersAsync();
      await promise;

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it('应该在请求失败后清除超时定时器', async () => {
      const error = new Error('Network error');
      (global.fetch as any).mockRejectedValue(error);

      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const promise = adapter.testFetchWithTimeout('https://example.com/api');

      // 立即添加catch处理器防止unhandled rejection
      const errorPromise = promise.catch((e) => e);
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow('Network error');
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('抽象方法实现要求', () => {
    it('子类应该实现getSelectedFiles方法', async () => {
      const files = await adapter.getSelectedFiles();
      expect(Array.isArray(files)).toBe(true);
    });

    it('子类应该实现renameFile方法', async () => {
      const result = await adapter.renameFile('file-1', 'new-name.txt');
      expect(result).toHaveProperty('success');
    });

    it('子类应该实现checkNameConflict方法', async () => {
      const hasConflict = await adapter.checkNameConflict('test.txt', '0');
      expect(typeof hasConflict).toBe('boolean');
    });

    it('子类应该实现getFileInfo方法', async () => {
      const fileInfo = await adapter.getFileInfo('file-1');
      expect(fileInfo).toHaveProperty('id');
      expect(fileInfo).toHaveProperty('name');
      expect(fileInfo).toHaveProperty('ext');
    });

    it('子类应该有platform属性', () => {
      expect(adapter.platform).toBeDefined();
      expect(typeof adapter.platform).toBe('string');
    });
  });

  describe('集成测试', () => {
    it('应该支持完整的配置-工具方法工作流', async () => {
      // 创建自定义配置的适配器
      const customAdapter = new TestAdapter({
        requestInterval: 500,
        timeout: 5000,
      });

      // 验证配置
      const config = customAdapter.getConfig();
      expect(config.requestInterval).toBe(500);
      expect(config.timeout).toBe(5000);

      // 使用工具方法
      const ext = customAdapter.testExtractExtension('test.file.txt');
      expect(ext).toBe('.txt');

      // 测试延迟
      const startTime = Date.now();
      await customAdapter.testSleep(100);
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(80);
    });
  });
});
