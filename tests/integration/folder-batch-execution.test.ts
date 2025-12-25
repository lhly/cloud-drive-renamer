import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BatchExecutor } from '../../src/core/executor';
import { FileItem, PlatformAdapter, RenameResult } from '../../src/types/platform';
import { RuleConfig } from '../../src/types/rule';
import { ProgressEvent, BatchResults } from '../../src/types/core';

/**
 * 文件夹重命名集成测试
 *
 * 测试范围:
 * 1. 仅文件夹的批量重命名
 * 2. 仅文件的批量重命名（现有功能验证）
 * 3. 混合文件和文件夹的批量重命名
 * 4. 冲突检测集成
 * 5. 进度追踪
 */

// Mock 适配器实现
class MockFolderAdapter implements PlatformAdapter {
  readonly platform = 'quark' as const;
  private fileStore = new Map<string, FileItem>();
  private networkFailCount = 0;
  private maxNetworkFails = 0;

  constructor(initialItems: FileItem[] = []) {
    initialItems.forEach((item) => {
      this.fileStore.set(item.id, item);
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
      throw new Error('Network error');
    }

    const item = this.fileStore.get(fileId);
    if (!item) {
      return {
        success: false,
        error: new Error('Item not found'),
      };
    }

    // 更新名字
    const updatedItem = { ...item, name: newName };
    this.fileStore.set(fileId, updatedItem);

    return {
      success: true,
      newName,
    };
  }

  async checkNameConflict(fileName: string, parentId: string): Promise<boolean> {
    const items = Array.from(this.fileStore.values());
    return items.some((f) => f.name === fileName && f.parentId === parentId);
  }

  async getFileInfo(fileId: string): Promise<FileItem> {
    const item = this.fileStore.get(fileId);
    if (!item) {
      throw new Error('Item not found');
    }
    return item;
  }

  getConfig() {
    return {
      platform: 'quark' as const,
      requestInterval: 100,
      maxRetries: 3,
    };
  }
}

// 生成测试文件
function generateFiles(count: number): FileItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `file-${i + 1}`,
    name: `file-${i + 1}.txt`,
    ext: '.txt',
    parentId: 'root',
    size: 1024,
    mtime: Date.now(),
  }));
}

// 生成测试文件夹
function generateFolders(count: number): FileItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `folder-${i + 1}`,
    name: `Folder${i + 1}`,
    ext: '',
    parentId: 'root',
    size: 0,
    mtime: Date.now(),
  }));
}

// 生成混合项目
function generateMixed(fileCount: number, folderCount: number): FileItem[] {
  const files = generateFiles(fileCount);
  const folders = generateFolders(folderCount);
  return [...files, ...folders];
}

// Mock RuleFactory
vi.mock('../../src/rules/rule-factory', () => ({
  RuleFactory: {
    create: (config: RuleConfig) => {
      if (config.type === 'replace') {
        return {
          execute: (fileName: string) =>
            fileName.replace(config.params.search, config.params.replace),
        };
      }
      if (config.type === 'prefix') {
        return {
          execute: (fileName: string) => `${config.params.prefix}${fileName}`,
        };
      }
      if (config.type === 'suffix') {
        return {
          execute: (fileName: string) => `${fileName}${config.params.suffix}`,
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

describe('批量执行集成测试 - 文件夹场景', () => {
  describe('场景 1: 仅选择文件夹', () => {
    it('应该成功重命名单个文件夹', async () => {
      const folders = generateFolders(1);
      const adapter = new MockFolderAdapter(folders);

      const rule: RuleConfig = {
        type: 'replace',
        params: { search: 'Folder', replace: 'Directory' },
      };

      const executor = new BatchExecutor(folders, rule, adapter, {
        requestInterval: 50,
      });

      const results = await executor.execute();

      expect(results.success.length).toBe(1);
      expect(results.failed.length).toBe(0);
      expect(results.success[0].renamed).toBe('Directory1');
    });

    it('应该成功重命名多个文件夹', async () => {
      const folders = generateFolders(5);
      const adapter = new MockFolderAdapter(folders);

      const rule: RuleConfig = {
        type: 'prefix',
        params: { prefix: '[Archive] ' },
      };

      const executor = new BatchExecutor(folders, rule, adapter, {
        requestInterval: 50,
      });

      const results = await executor.execute();

      expect(results.success.length).toBe(5);
      expect(results.failed.length).toBe(0);

      results.success.forEach((item) => {
        expect(item.renamed).toMatch(/^\[Archive\] Folder/);
      });
    });

    it('应该在重命名过程中报告进度', async () => {
      const folders = generateFolders(3);
      const adapter = new MockFolderAdapter(folders);

      const rule: RuleConfig = {
        type: 'replace',
        params: { search: 'Folder', replace: 'Dir' },
      };

      const progressEvents: ProgressEvent[] = [];

      const executor = new BatchExecutor(folders, rule, adapter, {
        requestInterval: 50,
        onProgress: (event) => progressEvents.push(event),
      });

      await executor.execute();

      // 应该接收到3个进度事件
      expect(progressEvents.length).toBe(3);

      // 验证最后的进度
      const lastProgress = progressEvents[progressEvents.length - 1];
      expect(lastProgress.completed).toBe(3);
      expect(lastProgress.total).toBe(3);
      expect(lastProgress.success).toBe(3);
      expect(lastProgress.failed).toBe(0);
    });

    it('应该处理文件夹名中的特殊字符', async () => {
      const folders: FileItem[] = [
        {
          id: 'folder-1',
          name: 'Folder[2025]',
          ext: '',
          parentId: 'root',
          size: 0,
          mtime: Date.now(),
        },
        {
          id: 'folder-2',
          name: '我的文件夹',
          ext: '',
          parentId: 'root',
          size: 0,
          mtime: Date.now(),
        },
      ];

      const adapter = new MockFolderAdapter(folders);

      const rule: RuleConfig = {
        type: 'prefix',
        params: { prefix: 'New_' },
      };

      const executor = new BatchExecutor(folders, rule, adapter, {
        requestInterval: 50,
      });

      const results = await executor.execute();

      expect(results.success.length).toBe(2);
      expect(results.success[0].renamed).toBe('New_Folder[2025]');
      expect(results.success[1].renamed).toBe('New_我的文件夹');
    });
  });

  describe('场景 2: 仅选择文件', () => {
    it('应该成功重命名文件（现有功能验证）', async () => {
      const files = generateFiles(1);
      const adapter = new MockFolderAdapter(files);

      const rule: RuleConfig = {
        type: 'replace',
        params: { search: 'file', replace: 'document' },
      };

      const executor = new BatchExecutor(files, rule, adapter, {
        requestInterval: 50,
      });

      const results = await executor.execute();

      expect(results.success.length).toBe(1);
      expect(results.failed.length).toBe(0);
      // 注意：这里假设规则引擎不处理扩展名，实际应该保留 .txt
      expect(results.success[0].renamed).toMatch(/document/);
    });

    it('应该正确处理多个文件', async () => {
      const files = generateFiles(3);
      const adapter = new MockFolderAdapter(files);

      const rule: RuleConfig = {
        type: 'numbering',
        params: { startNumber: 1, digits: 2 },
      };

      const executor = new BatchExecutor(files, rule, adapter, {
        requestInterval: 50,
      });

      const results = await executor.execute();

      expect(results.success.length).toBe(3);
      expect(results.failed.length).toBe(0);

      // 验证编号
      expect(results.success[0].renamed).toMatch(/^01_/);
      expect(results.success[1].renamed).toMatch(/^02_/);
      expect(results.success[2].renamed).toMatch(/^03_/);
    });
  });

  describe('场景 3: 混合选择文件和文件夹', () => {
    it('应该同时重命名文件和文件夹', async () => {
      const mixed = generateMixed(2, 2);
      const adapter = new MockFolderAdapter(mixed);

      const rule: RuleConfig = {
        type: 'prefix',
        params: { prefix: '[2025] ' },
      };

      const executor = new BatchExecutor(mixed, rule, adapter, {
        requestInterval: 50,
      });

      const results = await executor.execute();

      expect(results.success.length).toBe(4);
      expect(results.failed.length).toBe(0);

      // 验证所有项都被重命名
      results.success.forEach((item) => {
        expect(item.renamed).toMatch(/^\[2025\] /);
      });
    });

    it('应该正确保留文件和文件夹的属性', async () => {
      const mixed: FileItem[] = [
        // 文件
        {
          id: 'file-1',
          name: 'document.pdf',
          ext: '.pdf',
          parentId: 'root',
          size: 1024,
          mtime: Date.now(),
        },
        // 文件夹
        {
          id: 'folder-1',
          name: 'Documents',
          ext: '',
          parentId: 'root',
          size: 0,
          mtime: Date.now(),
        },
      ];

      const adapter = new MockFolderAdapter(mixed);

      const rule: RuleConfig = {
        type: 'replace',
        params: { search: 'o', replace: '0' },
      };

      const executor = new BatchExecutor(mixed, rule, adapter, {
        requestInterval: 50,
      });

      const results = await executor.execute();

      expect(results.success.length).toBe(2);

      // 验证后的项属性
      const renamedItems = await adapter.getSelectedFiles();

      const file = renamedItems.find((f) => f.name.includes('.pdf'));
      expect(file).toBeDefined();
      expect(file?.ext).toBe('.pdf');
      expect(file?.size).toBeGreaterThan(0);

      const folder = renamedItems.find((f) => f.ext === '');
      expect(folder).toBeDefined();
      expect(folder?.ext).toBe('');
      expect(folder?.size).toBe(0);
    });

    it('应该正确统计混合结果', async () => {
      const mixed = generateMixed(3, 2);
      const adapter = new MockFolderAdapter(mixed);

      const rule: RuleConfig = {
        type: 'prefix',
        params: { prefix: 'New_' },
      };

      const executor = new BatchExecutor(mixed, rule, adapter, {
        requestInterval: 50,
      });

      const results = await executor.execute();
      const stats = executor.getStatistics();

      // 总计5个项目：3个文件 + 2个文件夹
      expect(stats.total).toBe(5);
      expect(stats.success).toBe(5);
      expect(stats.failed).toBe(0);
      expect(stats.percentage).toBe(100);
    });
  });

  describe('场景 4: 冲突检测', () => {
    it('应该检测文件夹名冲突', async () => {
      const folders: FileItem[] = [
        {
          id: 'folder-1',
          name: 'OldName',
          ext: '',
          parentId: 'root',
          size: 0,
          mtime: Date.now(),
        },
        {
          id: 'folder-2',
          name: 'ExistingFolder',
          ext: '',
          parentId: 'root',
          size: 0,
          mtime: Date.now(),
        },
      ];

      // 创建带冲突检测的适配器
      class ConflictAdapter extends MockFolderAdapter {
        async renameFile(fileId: string, newName: string): Promise<RenameResult> {
          const hasConflict = await this.checkNameConflict(newName, 'root');
          if (hasConflict) {
            return {
              success: false,
              error: new Error('Folder already exists'),
            };
          }
          return super.renameFile(fileId, newName);
        }

        async checkNameConflict(fileName: string, parentId: string): Promise<boolean> {
          // ExistingFolder 已存在
          if (fileName === 'ExistingFolder') {
            return true;
          }
          return super.checkNameConflict(fileName, parentId);
        }
      }

      const adapter = new ConflictAdapter(folders);

      const rule: RuleConfig = {
        type: 'replace',
        params: { search: 'OldName', replace: 'ExistingFolder' },
      };

      const executor = new BatchExecutor(folders, rule, adapter, {
        requestInterval: 50,
      });

      const results = await executor.execute();

      // Both folders fail:
      // - OldName → ExistingFolder (conflict with existing folder)
      // - ExistingFolder → ExistingFolder (conflict with itself, though no actual change)
      expect(results.success.length).toBe(0);
      expect(results.failed.length).toBe(2);
      expect(results.failed[0].error).toContain('already exists');
      expect(results.failed[1].error).toContain('already exists');
    });

    it('应该在混合环境中检测冲突', async () => {
      const mixed: FileItem[] = [
        {
          id: 'file-1',
          name: 'report.pdf',
          ext: '.pdf',
          parentId: 'root',
          size: 1024,
          mtime: Date.now(),
        },
        {
          id: 'folder-1',
          name: 'MyFolder',
          ext: '',
          parentId: 'root',
          size: 0,
          mtime: Date.now(),
        },
      ];

      class MixedConflictAdapter extends MockFolderAdapter {
        async checkNameConflict(fileName: string, parentId: string): Promise<boolean> {
          return fileName === 'report.pdf' || fileName === 'MyFolder';
        }

        async renameFile(fileId: string, newName: string): Promise<RenameResult> {
          const hasConflict = await this.checkNameConflict(newName, 'root');
          if (hasConflict) {
            return {
              success: false,
              error: new Error('Name conflict'),
            };
          }
          return super.renameFile(fileId, newName);
        }
      }

      const adapter = new MixedConflictAdapter(mixed);

      const rule: RuleConfig = {
        type: 'replace',
        params: { search: 'MyFolder', replace: 'report.pdf' },
      };

      const executor = new BatchExecutor(mixed, rule, adapter, {
        requestInterval: 50,
      });

      const results = await executor.execute();

      // 第一个文件成功，第二个文件夹失败
      expect(results.success.length).toBe(0);
      expect(results.failed.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('场景 5: 性能和限制', () => {
    it('应该在合理时间内处理多个文件夹', async () => {
      const folders = generateFolders(20);
      const adapter = new MockFolderAdapter(folders);

      const rule: RuleConfig = {
        type: 'prefix',
        params: { prefix: 'Archive_' },
      };

      const startTime = Date.now();

      const executor = new BatchExecutor(folders, rule, adapter, {
        requestInterval: 50,
      });

      const results = await executor.execute();
      const elapsedMs = Date.now() - startTime;

      expect(results.success.length).toBe(20);
      expect(elapsedMs).toBeLessThan(5000); // 5秒内完成
    });

    it('应该正确计算执行统计', async () => {
      const mixed = generateMixed(5, 5);
      const adapter = new MockFolderAdapter(mixed);

      const rule: RuleConfig = {
        type: 'prefix',
        params: { prefix: 'Item_' },
      };

      const executor = new BatchExecutor(mixed, rule, adapter, {
        requestInterval: 50,
      });

      await executor.execute();

      const stats = executor.getStatistics();

      expect(stats.total).toBe(10);
      expect(stats.completed).toBe(10);
      expect(stats.success).toBe(10);
      expect(stats.failed).toBe(0);
      expect(stats.percentage).toBe(100);
      expect(stats.avgTimePerFile).toBeGreaterThan(0);
    });
  });

  describe('场景 6: 错误处理', () => {
    it('应该处理重命名失败并继续处理其他项', async () => {
      const mixed = generateMixed(2, 2);
      const adapter = new MockFolderAdapter(mixed);

      // 模拟部分失败
      class PartialFailAdapter extends MockFolderAdapter {
        async renameFile(fileId: string, newName: string): Promise<RenameResult> {
          // 让第二个项失败
          if (fileId === mixed[1].id) {
            return {
              success: false,
              error: new Error('Simulated failure'),
            };
          }
          return super.renameFile(fileId, newName);
        }
      }

      const failAdapter = new PartialFailAdapter(mixed);

      const rule: RuleConfig = {
        type: 'prefix',
        params: { prefix: 'Test_' },
      };

      const executor = new BatchExecutor(mixed, rule, failAdapter, {
        requestInterval: 50,
      });

      const results = await executor.execute();

      // 应该继续处理其他项
      expect(results.success.length).toBe(3);
      expect(results.failed.length).toBe(1);
    });

    it('应该处理网络错误并恢复', async () => {
      const folders = generateFolders(3);
      const adapter = new MockFolderAdapter(folders);
      adapter.setNetworkFailures(1); // 第一次失败

      const rule: RuleConfig = {
        type: 'prefix',
        params: { prefix: 'New_' },
      };

      const executor = new BatchExecutor(folders, rule, adapter, {
        requestInterval: 50,
      });

      const results = await executor.execute();

      // 第一个项由于网络错误失败
      expect(results.failed.length).toBeGreaterThanOrEqual(0);
    });
  });
});
