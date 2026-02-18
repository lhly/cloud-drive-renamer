import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CrashRecoveryManager } from '../../src/core/crash-recovery';

vi.mock('../../src/rules/rule-factory', () => ({
  RuleFactory: { create: () => ({ execute: (name: string) => `rule_${name}` }) },
}));

type StorageShape = Record<string, any>;

class MockAdapter {
  platform = 'quark' as const;
  renameCalls: string[] = [];

  async renameFile(_id: string, newName: string) {
    this.renameCalls.push(newName);
    return { success: true, newName };
  }

  async getSelectedFiles() {
    return [];
  }

  async getAllFiles() {
    return [];
  }

  async checkNameConflict() {
    return false;
  }

  async getFileInfo(id: string) {
    return { id, name: 'a.txt', ext: '.txt', parentId: '0', size: 1, mtime: 1 };
  }

  getConfig() {
    return { platform: 'quark', requestInterval: 0, maxRetries: 1 };
  }
}

describe('CrashRecoveryManager', () => {
  let storageData: StorageShape;

  beforeEach(() => {
    storageData = {};

    const storageLocal = {
      set: vi.fn(async (items: StorageShape) => {
        Object.assign(storageData, items);
      }),
      get: vi.fn(async (key: string | null) => {
        if (!key) return storageData;
        return { [key]: storageData[key] };
      }),
      remove: vi.fn(async (key: string) => {
        delete storageData[key];
      }),
      clear: vi.fn(async () => {
        storageData = {};
      }),
    };

    global.chrome = {
      storage: { local: storageLocal },
    } as any;

    global.localStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    } as any;
  });

  it('resumeOperation should use saved tasks when provided', async () => {
    const recovery = new CrashRecoveryManager();
    const adapter = new MockAdapter();

    await recovery.saveOperationState({
      platform: 'quark',
      files: [
        { id: '1', name: 'a.txt', ext: '.txt', parentId: '0', size: 1, mtime: 1 },
      ],
      rule: { type: 'prefix', params: { prefix: 'x_' } },
      completed: [],
      failed: [],
      tasks: [
        {
          file: { id: '1', name: 'a.txt', ext: '.txt', parentId: '0', size: 1, mtime: 1 },
          newName: 'custom.txt',
          index: 0,
        },
      ],
    } as any);

    const saved = await recovery.checkRecoverableOperation();
    await recovery.resumeOperation(saved!, adapter as any);

    expect(adapter.renameCalls[0]).toBe('custom.txt');
  });
});
