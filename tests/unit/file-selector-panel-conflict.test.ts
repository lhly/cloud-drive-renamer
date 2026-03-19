import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileSelectorPanel } from '../../src/content/components/file-selector-panel';
import { BatchExecutor, ExecutorState } from '../../src/core/executor';
import { ConflictResolution, ConflictType } from '../../src/core/conflict-detector';
import { crashRecovery } from '../../src/core/crash-recovery';
import { FileItem, PlatformAdapter, RenameResult } from '../../src/types/platform';

type FileSelectorPanelConflictHarness = FileSelectorPanel & {
  allFiles: FileItem[];
  newNameMap: Map<string, string>;
  uncheckList: Set<string>;
  extractErrorMap: Map<string, string>;
  handleExecute(): Promise<void>;
  executionItems: Array<{ file: FileItem; newName: string }>;
  open: boolean;
  updateComplete: Promise<void>;
  loadAllFiles(): Promise<void>;
  ensureCrashRecovery(): Promise<void>;
};

type ConflictDialogElement = HTMLElement & {
  open: boolean;
  items: Array<{
    fileId: string;
    originalName: string;
    targetName: string;
    type: ConflictType;
    conflictingFiles: string[];
  }>;
};

class ConflictTestAdapter implements PlatformAdapter {
  readonly platform = 'aliyun' as const;
  readonly checkNameConflict = vi.fn(async (_fileName: string, _parentId: string) => false);

  getCurrentDirectoryKey(): string {
    return 'root';
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

  async getFileInfo(fileId: string): Promise<FileItem> {
    return {
      id: fileId,
      name: `${fileId}.png`,
      ext: '.png',
      parentId: 'root',
      size: 1,
      mtime: Date.now(),
    };
  }

  getConfig() {
    return {
      platform: 'aliyun' as const,
      requestInterval: 0,
      maxConcurrent: 1,
      maxRetries: 1,
    };
  }
}

const files: FileItem[] = [
  {
    id: '1',
    name: 'tile-board.png',
    ext: '.png',
    parentId: 'root',
    size: 1,
    mtime: 1,
  },
  {
    id: '2',
    name: '2p5d-slice-smoke.png',
    ext: '.png',
    parentId: 'root',
    size: 1,
    mtime: 1,
  },
  {
    id: '3',
    name: 'default-entry-smoke.png',
    ext: '.png',
    parentId: 'root',
    size: 1,
    mtime: 1,
  },
];

describe('FileSelectorPanel conflict execution flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: vi.fn(async () => ({})),
          set: vi.fn(async () => undefined),
          remove: vi.fn(async () => undefined),
          clear: vi.fn(async () => undefined),
        },
      },
    });
    vi.stubGlobal('alert', vi.fn());
    vi.stubGlobal('prompt', vi.fn(() => null));
    vi.spyOn(crashRecovery, 'saveOperationState').mockResolvedValue();
    vi.spyOn(crashRecovery, 'clearOperationState').mockResolvedValue();
    vi.spyOn(BatchExecutor.prototype, 'execute').mockResolvedValue({
      success: [
        {
          fileId: '1',
          original: 'tile-board.png',
          renamed: 'TTTtile-board.png',
          index: 0,
        },
      ],
      failed: [],
    });
    vi.spyOn(BatchExecutor.prototype, 'getState').mockReturnValue(ExecutorState.COMPLETED);
  });

  it('only checks conflicts for files whose names actually change', async () => {
    const adapter = new ConflictTestAdapter();
    const panel = new FileSelectorPanel() as FileSelectorPanelConflictHarness;
    panel.adapter = adapter;
    panel.allFiles = files;
    panel.uncheckList = new Set();
    panel.extractErrorMap = new Map();
    panel.newNameMap = new Map([
      ['1', 'TTTtile-board.png'],
      ['2', '2p5d-slice-smoke.png'],
      ['3', 'default-entry-smoke.png'],
    ]);

    await panel.handleExecute();

    expect(adapter.checkNameConflict).toHaveBeenCalledTimes(1);
    expect(adapter.checkNameConflict).toHaveBeenCalledWith('TTTtile-board.png', 'root');
  });

  it('continues execution when unchanged files would only conflict with themselves', async () => {
    const adapter = new ConflictTestAdapter();
    adapter.checkNameConflict.mockImplementation(async (fileName: string) => fileName !== 'TTTtile-board.png');

    const panel = new FileSelectorPanel() as FileSelectorPanelConflictHarness;
    panel.adapter = adapter;
    panel.allFiles = files;
    panel.uncheckList = new Set();
    panel.extractErrorMap = new Map();
    panel.newNameMap = new Map([
      ['1', 'TTTtile-board.png'],
      ['2', '2p5d-slice-smoke.png'],
      ['3', 'default-entry-smoke.png'],
    ]);

    await panel.handleExecute();

    expect(crashRecovery.saveOperationState).toHaveBeenCalledTimes(1);
    expect(crashRecovery.saveOperationState).toHaveBeenCalledWith(
      expect.objectContaining({
        files: [expect.objectContaining({ id: '1', name: 'tile-board.png' })],
      })
    );
    expect(panel.executionItems.map((item) => item.file.id)).toEqual(['1']);
  });

  it('waits for user conflict resolution from the custom dialog before building the execution plan', async () => {
    const adapter = new ConflictTestAdapter();
    adapter.checkNameConflict.mockResolvedValue(true);
    vi.spyOn(adapter, 'getAllFiles').mockResolvedValue([files[0]]);

    const panel = new FileSelectorPanel() as FileSelectorPanelConflictHarness;
    panel.adapter = adapter;
    panel.open = true;
    panel.allFiles = [files[0]];
    panel.uncheckList = new Set();
    panel.extractErrorMap = new Map();
    panel.newNameMap = new Map([['1', 'taken.png']]);

    vi.spyOn(panel, 'loadAllFiles').mockResolvedValue(undefined);
    vi.spyOn(panel, 'ensureCrashRecovery').mockResolvedValue(undefined);

    document.body.appendChild(panel);
    await panel.updateComplete;

    const executePromise = panel.handleExecute();
    await Promise.resolve();
    await Promise.resolve();
    await panel.updateComplete;

    expect(crashRecovery.saveOperationState).not.toHaveBeenCalled();

    await vi.waitFor(() => {
      const dialog = panel.shadowRoot?.querySelector('conflict-resolution-dialog') as ConflictDialogElement | null;
      expect(dialog).toBeTruthy();
      expect(dialog?.open).toBe(true);
    });

    const dialog = panel.shadowRoot?.querySelector('conflict-resolution-dialog') as ConflictDialogElement | null;
    dialog?.dispatchEvent(new CustomEvent('conflict-dialog-resolve', {
      detail: { resolution: ConflictResolution.AUTO_NUMBER },
      bubbles: true,
      composed: true,
    }));

    await executePromise;

    expect(crashRecovery.saveOperationState).toHaveBeenCalledTimes(1);
    expect(panel.executionItems[0].newName).toMatch(/taken\(1\)\.png/);

    panel.remove();
  });

  it('opens the custom dialog and renders real external conflicts with detail rows', async () => {
    const adapter = new ConflictTestAdapter();
    adapter.checkNameConflict.mockResolvedValue(true);
    vi.spyOn(adapter, 'getAllFiles').mockResolvedValue([files[0]]);

    const panel = new FileSelectorPanel() as FileSelectorPanelConflictHarness;
    panel.adapter = adapter;
    panel.open = true;
    panel.allFiles = [files[0]];
    panel.uncheckList = new Set();
    panel.extractErrorMap = new Map();
    panel.newNameMap = new Map([['1', 'taken.png']]);

    vi.spyOn(panel, 'loadAllFiles').mockResolvedValue(undefined);
    vi.spyOn(panel, 'ensureCrashRecovery').mockResolvedValue(undefined);

    document.body.appendChild(panel);
    await panel.updateComplete;

    const executePromise = panel.handleExecute();
    await Promise.resolve();
    await Promise.resolve();
    await panel.updateComplete;

    const expectedItems = [
      {
        fileId: '1',
        originalName: 'tile-board.png',
        targetName: 'taken.png',
        type: ConflictType.NAME_EXISTS,
        conflictingFiles: [],
      },
    ];

    await vi.waitFor(() => {
      const dialog = panel.shadowRoot?.querySelector('conflict-resolution-dialog') as ConflictDialogElement | null;
      expect(dialog).toBeTruthy();
      expect(dialog?.items).toEqual(expectedItems);
    });

    const dialog = panel.shadowRoot?.querySelector('conflict-resolution-dialog') as ConflictDialogElement | null;
    dialog?.dispatchEvent(new CustomEvent('dialog-close', { bubbles: true, composed: true }));
    await executePromise;

    expect(crashRecovery.saveOperationState).not.toHaveBeenCalled();

    panel.remove();
  });
});
