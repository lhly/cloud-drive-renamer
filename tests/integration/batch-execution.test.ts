import { describe, it, expect, beforeEach } from 'vitest';
import { BatchExecutor } from '../../src/core/executor';
import { CrashRecoveryManager } from '../../src/core/crash-recovery';
import { ConflictDetector } from '../../src/core/conflict-detector';
import { FileItem, PlatformAdapter, RenameResult } from '../../src/types/platform';
import { RuleConfig } from '../../src/types/rule';

/**
 * 集成测试 - 批量执行
 *
 * 测试场景:
 * 1. 10个文件字符串替换
 * 2. 50个文件自动编号
 * 3. 100个文件多规则链式
 * 4. 网络中断恢复测试
 */

// Mock adapter for integration testing
class IntegrationMockAdapter implements PlatformAdapter {
  readonly platform = 'quark' as const;
  private fileStore = new Map<string, FileItem>();
  private networkFailCount = 0;
  private maxNetworkFails = 0;

  constructor(initialFiles: FileItem[] = []) {
    initialFiles.forEach((file) => {
      this.fileStore.set(file.id, file);
    });
  }

  setNetworkFailures(count: number) {
    this.networkFailCount = 0;
    this.maxNetworkFails = count;
  }

  async getSelectedFiles(): Promise<FileItem[]> {
    return Array.from(this.fileStore.values());
  }

  async renameFile(fileId: string, newName: string): Promise<RenameResult> {
    // 模拟网络失败
    if (this.networkFailCount < this.maxNetworkFails) {
      this.networkFailCount++;
      throw new Error('network error');
    }

    const file = this.fileStore.get(fileId);
    if (!file) {
      return {
        success: false,
        error: new Error('File not found'),
      };
    }

    // 更新文件名
    const updatedFile = { ...file, name: newName };
    this.fileStore.set(fileId, updatedFile);

    return {
      success: true,
      newName,
    };
  }

  async checkNameConflict(fileName: string, parentId: string): Promise<boolean> {
    const files = Array.from(this.fileStore.values());
    return files.some((f) => f.name === fileName && f.parentId === parentId);
  }

  async getFileInfo(fileId: string): Promise<FileItem> {
    const file = this.fileStore.get(fileId);
    if (!file) {
      throw new Error('File not found');
    }
    return file;
  }

  getConfig() {
    return {
      platform: 'quark' as const,
      requestInterval: 100, // 测试时使用较短间隔
      maxRetries: 3,
    };
  }
}

// 生成测试文件
function generateTestFiles(count: number): FileItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `file-${i + 1}`,
    name: `test-file-${i + 1}.txt`,
    ext: '.txt',
    parentId: '0',
    size: 1024,
    mtime: Date.now(),
  }));
}

// Mock RuleFactory
import { vi } from 'vitest';

vi.mock('../../src/rules/rule-factory', () => ({
  RuleFactory: {
    create: (config: RuleConfig) => {
      if (config.type === 'replace') {
        return {
          execute: (fileName: string) =>
            fileName.replace(config.params.search, config.params.replace),
        };
      }
      if (config.type === 'numbering') {
        return {
          execute: (fileName: string, index: number) => {
            const num = (config.params.startNumber + index)
              .toString()
              .padStart(config.params.digits, '0');
            return `${num}_${fileName}`;
          },
        };
      }
      return {
        execute: (fileName: string) => fileName,
      };
    },
  },
}));

describe('批量执行集成测试', () => {
  describe('场景1: 10个文件字符串替换', () => {
    it('应该成功替换所有文件名', async () => {
      const files = generateTestFiles(10);
      const adapter = new IntegrationMockAdapter(files);

      const rule: RuleConfig = {
        type: 'replace',
        params: {
          search: 'test',
          replace: 'demo',
        },
      };

      const executor = new BatchExecutor(files, rule, adapter, {
        requestInterval: 50,
      });

      const results = await executor.execute();

      expect(results.success.length).toBe(10);
      expect(results.failed.length).toBe(0);

      // 验证文件名已更新
      const updatedFiles = await adapter.getSelectedFiles();
      updatedFiles.forEach((file) => {
        expect(file.name).toContain('demo');
        expect(file.name).not.toContain('test');
      });
    }, 10000);

    it('应该在2秒内完成', async () => {
      const files = generateTestFiles(10);
      const adapter = new IntegrationMockAdapter(files);

      const rule: RuleConfig = {
        type: 'replace',
        params: {
          search: 'test',
          replace: 'demo',
        },
      };

      const startTime = Date.now();
      const executor = new BatchExecutor(files, rule, adapter, {
        requestInterval: 50,
      });

      await executor.execute();

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(2000);
    });
  });

  describe('场景2: 50个文件自动编号', () => {
    it('应该成功为所有文件添加编号', async () => {
      const files = generateTestFiles(50);
      const adapter = new IntegrationMockAdapter(files);

      const rule: RuleConfig = {
        type: 'numbering',
        params: {
          startNumber: 1,
          digits: 3,
        },
      };

      const executor = new BatchExecutor(files, rule, adapter, {
        requestInterval: 50,
      });

      const results = await executor.execute();

      expect(results.success.length).toBe(50);
      expect(results.failed.length).toBe(0);

      // 验证编号正确
      const updatedFiles = await adapter.getSelectedFiles();
      expect(updatedFiles[0].name).toMatch(/^001_/);
      expect(updatedFiles[49].name).toMatch(/^050_/);
    }, 15000);
  });

  describe('场景3: 100个文件批量操作', () => {
    it('应该在2分钟内完成100个文件', async () => {
      const files = generateTestFiles(100);
      const adapter = new IntegrationMockAdapter(files);

      const rule: RuleConfig = {
        type: 'replace',
        params: {
          search: 'test',
          replace: 'demo',
        },
      };

      const startTime = Date.now();
      const executor = new BatchExecutor(files, rule, adapter, {
        requestInterval: 50, // 测试时使用较短间隔
      });

      const results = await executor.execute();

      const elapsed = Date.now() - startTime;

      expect(results.success.length).toBe(100);
      expect(results.failed.length).toBe(0);
      // 在实际场景中应该<120秒,测试时使用较短间隔所以时间更短
      expect(elapsed).toBeLessThan(10000);
    }, 15000);

    it('应该正确跟踪进度', async () => {
      const files = generateTestFiles(100);
      const adapter = new IntegrationMockAdapter(files);

      const rule: RuleConfig = {
        type: 'replace',
        params: {
          search: 'test',
          replace: 'demo',
        },
      };

      const progressEvents: any[] = [];

      const executor = new BatchExecutor(files, rule, adapter, {
        requestInterval: 50,
        onProgress: (progress) => {
          progressEvents.push({ ...progress });
        },
      });

      await executor.execute();

      // 应该有100个进度事件
      expect(progressEvents.length).toBe(100);

      // 第一个和最后一个进度事件
      expect(progressEvents[0].completed).toBe(1);
      expect(progressEvents[99].completed).toBe(100);
    }, 15000);
  });

  describe('场景4: 网络中断恢复测试', () => {
    it('应该在网络恢复后继续执行', async () => {
      const files = generateTestFiles(10);
      const adapter = new IntegrationMockAdapter(files);

      // 模拟前5个请求失败
      adapter.setNetworkFailures(5);

      const rule: RuleConfig = {
        type: 'replace',
        params: {
          search: 'test',
          replace: 'demo',
        },
      };

      const executor = new BatchExecutor(files, rule, adapter, {
        requestInterval: 50,
      });

      const results = await executor.execute();

      // 由于网络错误,前5个会失败
      expect(results.failed.length).toBeGreaterThan(0);
      // 但后面的应该成功
      expect(results.success.length).toBeGreaterThan(0);
    }, 10000);
  });

  describe('冲突检测集成', () => {
    it('应该检测批量内部冲突', async () => {
      const files = generateTestFiles(5);
      const adapter = new IntegrationMockAdapter(files);

      const detector = new ConflictDetector(adapter);

      // 所有文件重命名为相同名称
      const newNames = Array(5).fill('same-name.txt');

      const conflicts = await detector.detectConflicts(files, newNames);

      // 应该检测到冲突
      const conflictCount = Array.from(conflicts.values()).filter((c) => c.hasConflict).length;
      expect(conflictCount).toBeGreaterThan(0);
    });
  });
});
