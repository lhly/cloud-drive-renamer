import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileSelectorPanel } from '../../src/content/components/file-selector-panel';
import { FileItem, PlatformAdapter, RenameResult } from '../../src/types/platform';
import { BatchResults } from '../../src/types/core';
import { LastRenameOperation } from '../../src/types/undo';

type FileSelectorPanelTestHarness = FileSelectorPanel & {
  lastRenameOperation: LastRenameOperation | null;
  allFiles: FileItem[];
  executionResults: BatchResults | null;
  clearLastRenameOperationIfOutOfScope(): void;
  updateLastRenameOperationFromExecute(results: BatchResults): void;
  mergeLastRenameOperationFromRetry(results: BatchResults): void;
  handleUndoLastRename(): Promise<void>;
};

class PanelMockAdapter implements PlatformAdapter {
  readonly platform = 'quark' as const;
  directoryKey = 'dir-a';

  getCurrentDirectoryKey(): string {
    return this.directoryKey;
  }

  async getSelectedFiles(): Promise<FileItem[]> {
    return [];
  }

  async getAllFiles(): Promise<FileItem[]> {
    return [];
  }

  async renameFile(_fileId: string, newName: string): Promise<RenameResult> {
    return { success: true, newName };
  }

  async checkNameConflict(): Promise<boolean> {
    return false;
  }

  async getFileInfo(fileId: string): Promise<FileItem> {
    return {
      id: fileId,
      name: `${fileId}.txt`,
      ext: '.txt',
      parentId: this.directoryKey,
      size: 0,
      mtime: Date.now(),
    };
  }

  getConfig() {
    return {
      platform: 'quark' as const,
      requestInterval: 10,
      maxRetries: 3,
    };
  }
}

describe('FileSelectorPanel undo helpers', () => {
  beforeEach(() => {
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: vi.fn(async () => ({})),
          set: vi.fn(async () => undefined),
          remove: vi.fn(async () => undefined),
        },
      },
    });
  });

  it('clears last rename operation when current scope no longer matches', () => {
    const panel = new FileSelectorPanel() as FileSelectorPanelTestHarness;
    const adapter = new PanelMockAdapter();
    panel.adapter = adapter;
    panel.lastRenameOperation = {
      platform: 'quark',
      directoryKey: 'dir-b',
      createdAt: 1,
      updatedAt: 1,
      items: [{ fileId: '1', original: 'a.txt', renamed: 'b.txt', index: 0 }],
    };

    panel.clearLastRenameOperationIfOutOfScope();

    expect(panel.lastRenameOperation).toBeNull();
  });

  it('stores a new last rename operation after execute success results', () => {
    const panel = new FileSelectorPanel() as FileSelectorPanelTestHarness;
    const adapter = new PanelMockAdapter();
    panel.adapter = adapter;

    const results: BatchResults = {
      success: [{ fileId: '1', original: 'old-a.txt', renamed: 'new-a.txt', index: 0 }],
      failed: [],
    };

    panel.updateLastRenameOperationFromExecute(results);

    expect(panel.lastRenameOperation?.directoryKey).toBe('dir-a');
    expect(panel.lastRenameOperation?.items).toEqual([
      { fileId: '1', original: 'old-a.txt', renamed: 'new-a.txt', index: 0 },
    ]);
  });

  it('merges retry success items into the current last rename operation', () => {
    const panel = new FileSelectorPanel() as FileSelectorPanelTestHarness;
    const adapter = new PanelMockAdapter();
    panel.adapter = adapter;
    panel.lastRenameOperation = {
      platform: 'quark',
      directoryKey: 'dir-a',
      createdAt: 1,
      updatedAt: 1,
      items: [{ fileId: '1', original: 'old-a.txt', renamed: 'new-a.txt', index: 0 }],
    };

    const retryResults: BatchResults = {
      success: [{ fileId: '2', original: 'old-b.txt', renamed: 'new-b.txt', index: 1 }],
      failed: [],
    };

    panel.mergeLastRenameOperationFromRetry(retryResults);

    expect(panel.lastRenameOperation?.items.map((item) => item.fileId)).toEqual(['1', '2']);
  });

  it('undoes the last rename operation and clears the record after full success', async () => {
    const panel = new FileSelectorPanel() as FileSelectorPanelTestHarness;
    const adapter = new PanelMockAdapter();
    panel.adapter = adapter;
    panel.allFiles = [
      {
        id: '1',
        name: 'new-a.txt',
        ext: '.txt',
        parentId: 'dir-a',
        size: 0,
        mtime: Date.now(),
      },
    ];
    panel.lastRenameOperation = {
      platform: 'quark',
      directoryKey: 'dir-a',
      createdAt: 1,
      updatedAt: 1,
      items: [{ fileId: '1', original: 'old-a.txt', renamed: 'new-a.txt', index: 0 }],
    };

    await panel.handleUndoLastRename();

    expect(panel.lastRenameOperation).toBeNull();
    expect(panel.allFiles[0].name).toBe('old-a.txt');
    expect(panel.executionResults?.success).toHaveLength(1);
  });

  it('undoes both initial success items and retry-merged success items together', async () => {
    const panel = new FileSelectorPanel() as FileSelectorPanelTestHarness;
    const adapter = new PanelMockAdapter();
    panel.adapter = adapter;
    panel.allFiles = [
      {
        id: '1',
        name: 'new-a.txt',
        ext: '.txt',
        parentId: 'dir-a',
        size: 0,
        mtime: Date.now(),
      },
      {
        id: '2',
        name: 'new-b.txt',
        ext: '.txt',
        parentId: 'dir-a',
        size: 0,
        mtime: Date.now(),
      },
    ];
    panel.lastRenameOperation = {
      platform: 'quark',
      directoryKey: 'dir-a',
      createdAt: 1,
      updatedAt: 1,
      items: [{ fileId: '1', original: 'old-a.txt', renamed: 'new-a.txt', index: 0 }],
    };

    panel.mergeLastRenameOperationFromRetry({
      success: [{ fileId: '2', original: 'old-b.txt', renamed: 'new-b.txt', index: 1 }],
      failed: [],
    });

    await panel.handleUndoLastRename();

    expect(panel.lastRenameOperation).toBeNull();
    expect(panel.allFiles.map((file) => file.name)).toEqual(['old-a.txt', 'old-b.txt']);
    expect(panel.executionResults?.success).toHaveLength(2);
  });
});
