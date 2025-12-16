import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BatchExecutor, ExecutorState } from '../../src/core/executor';
import { FileItem, PlatformAdapter, RenameResult } from '../../src/types/platform';
import { RuleConfig } from '../../src/types/rule';

// Mock adapter
class MockAdapter implements PlatformAdapter {
  readonly platform = 'quark' as const;
  renameDelay = 100; // 模拟API延迟
  failureRate = 0; // 失败率(0-1)

  async getSelectedFiles(): Promise<FileItem[]> {
    return [];
  }

  async renameFile(fileId: string, newName: string): Promise<RenameResult> {
    // 模拟延迟
    await new Promise((resolve) => setTimeout(resolve, this.renameDelay));

    // 模拟失败
    if (Math.random() < this.failureRate) {
      return {
        success: false,
        error: new Error('Mock rename failed'),
      };
    }

    return {
      success: true,
      newName,
    };
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

  getConfig() {
    return {
      platform: 'quark' as const,
      requestInterval: 800,
      maxRetries: 3,
    };
  }
}

// Mock rule
const mockRule: RuleConfig = {
  type: 'prefix',
  params: {
    prefix: 'test_',
  },
};

// Mock RuleFactory
vi.mock('../../src/rules/rule-factory', () => ({
  RuleFactory: {
    create: () => ({
      execute: (fileName: string, index: number) => `test_${fileName}`,
    }),
  },
}));

describe('BatchExecutor', () => {
  let adapter: MockAdapter;
  let files: FileItem[];

  beforeEach(() => {
    adapter = new MockAdapter();
    files = [
      {
        id: '1',
        name: 'file1.txt',
        ext: '.txt',
        parentId: '0',
        size: 1024,
        mtime: Date.now(),
      },
      {
        id: '2',
        name: 'file2.txt',
        ext: '.txt',
        parentId: '0',
        size: 2048,
        mtime: Date.now(),
      },
      {
        id: '3',
        name: 'file3.txt',
        ext: '.txt',
        parentId: '0',
        size: 3072,
        mtime: Date.now(),
      },
    ];
  });

  describe('构造函数', () => {
    it('应该正确初始化', () => {
      const executor = new BatchExecutor(files, mockRule, adapter, {
        requestInterval: 800,
      });

      expect(executor.getState()).toBe(ExecutorState.IDLE);
    });

    it('空文件列表应该抛出错误', () => {
      expect(() => {
        new BatchExecutor([], mockRule, adapter, {
          requestInterval: 800,
        });
      }).toThrow('Files array cannot be empty');
    });

    it('缺少规则应该抛出错误', () => {
      expect(() => {
        new BatchExecutor(files, null as any, adapter, {
          requestInterval: 800,
        });
      }).toThrow('Rule configuration is required');
    });
  });

  describe('execute', () => {
    it('应该成功执行批量重命名', async () => {
      const executor = new BatchExecutor(files, mockRule, adapter, {
        requestInterval: 100, // 使用较短的间隔加快测试
      });

      const results = await executor.execute();

      expect(results.success.length).toBe(3);
      expect(results.failed.length).toBe(0);
      expect(executor.getState()).toBe(ExecutorState.COMPLETED);
    });

    it('应该控制请求间隔', async () => {
      const startTime = Date.now();
      const requestInterval = 200;

      const executor = new BatchExecutor(files, mockRule, adapter, {
        requestInterval,
      });

      await executor.execute();

      const elapsed = Date.now() - startTime;
      const expectedMin = (files.length - 1) * requestInterval;

      // 实际时间应该大于预期最小时间
      expect(elapsed).toBeGreaterThanOrEqual(expectedMin);
    });

    it('应该触发进度回调', async () => {
      const progressEvents: any[] = [];

      const executor = new BatchExecutor(files, mockRule, adapter, {
        requestInterval: 100,
        onProgress: (progress) => {
          progressEvents.push(progress);
        },
      });

      await executor.execute();

      expect(progressEvents.length).toBe(files.length);
      expect(progressEvents[0].completed).toBe(1);
      expect(progressEvents[2].completed).toBe(3);
    });

    it('应该触发完成回调', async () => {
      let completedResults: any = null;

      const executor = new BatchExecutor(files, mockRule, adapter, {
        requestInterval: 100,
        onComplete: (results) => {
          completedResults = results;
        },
      });

      await executor.execute();

      expect(completedResults).not.toBeNull();
      expect(completedResults.success.length).toBe(3);
    });

    it('应该处理部分失败', async () => {
      adapter.failureRate = 0.5; // 50%失败率

      const executor = new BatchExecutor(files, mockRule, adapter, {
        requestInterval: 100,
      });

      const results = await executor.execute();

      expect(results.success.length + results.failed.length).toBe(files.length);
    });
  });

  describe('pause/resume', () => {
    it('应该支持暂停和恢复', async () => {
      const executor = new BatchExecutor(files, mockRule, adapter, {
        requestInterval: 100,
      });

      // 启动执行
      const executePromise = executor.execute();

      // 等待一段时间后暂停
      await new Promise((resolve) => setTimeout(resolve, 150));
      executor.pause();

      expect(executor.getState()).toBe(ExecutorState.PAUSED);

      // 等待一段时间后恢复
      await new Promise((resolve) => setTimeout(resolve, 200));
      executor.resume();

      expect(executor.getState()).toBe(ExecutorState.RUNNING);

      // 等待完成
      await executePromise;

      expect(executor.getState()).toBe(ExecutorState.COMPLETED);
    });
  });

  describe('cancel', () => {
    it('应该支持取消', async () => {
      const executor = new BatchExecutor(files, mockRule, adapter, {
        requestInterval: 100,
      });

      // 启动执行
      const executePromise = executor.execute();

      // 等待一段时间后取消
      await new Promise((resolve) => setTimeout(resolve, 150));
      executor.cancel();

      expect(executor.getState()).toBe(ExecutorState.CANCELLED);

      // 等待完成
      await executePromise;

      const results = executor.getResults();
      // 取消后不是所有文件都会完成
      expect(results.success.length + results.failed.length).toBeLessThan(files.length);
    });
  });

  describe('getStatistics', () => {
    it('应该返回正确的统计信息', async () => {
      const executor = new BatchExecutor(files, mockRule, adapter, {
        requestInterval: 100,
      });

      await executor.execute();

      const stats = executor.getStatistics();

      expect(stats.completed).toBe(files.length);
      expect(stats.total).toBe(files.length);
      expect(stats.percentage).toBe(100);
      expect(stats.elapsed).toBeGreaterThan(0);
    });
  });
});
