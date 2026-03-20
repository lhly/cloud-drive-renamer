import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileSelectorPanel } from '../../src/content/components/file-selector-panel';
import { BatchExecutor, ExecutorState } from '../../src/core/executor';
import { crashRecovery } from '../../src/core/crash-recovery';
import { DIAGNOSTIC_STORAGE_KEYS, type DiagnosticExportPayload } from '../../src/types/diagnostic';
import { type BatchResults } from '../../src/types/core';
import { type FileItem, type PlatformAdapter, type RenameResult } from '../../src/types/platform';

type FileSelectorPanelDiagnosticHarness = FileSelectorPanel & {
  allFiles: FileItem[];
  newNameMap: Map<string, string>;
  uncheckList: Set<string>;
  extractErrorMap: Map<string, string>;
  diagnosticPromptState: string;
  diagnosticFailureCount: number;
  diagnosticFileName: string | null;
  diagnosticErrorMessage: string | null;
  handleExecute(): Promise<void>;
  handleDiagnosticExport(): Promise<void>;
};

class DiagnosticTestAdapter implements PlatformAdapter {
  readonly platform = 'quark' as const;

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

  async checkNameConflict(): Promise<boolean> {
    return false;
  }

  async getFileInfo(fileId: string): Promise<FileItem> {
    return {
      id: fileId,
      name: `${fileId}.txt`,
      ext: '.txt',
      parentId: 'root',
      size: 1,
      mtime: 1,
    };
  }

  getConfig() {
    return {
      platform: 'quark' as const,
      requestInterval: 0,
      maxConcurrent: 1,
      maxRetries: 1,
    };
  }
}

describe('FileSelectorPanel diagnostic feedback flow', () => {
  const file: FileItem = {
    id: 'file-1',
    name: 'old-a.txt',
    ext: '.txt',
    parentId: 'root',
    size: 1,
    mtime: 1,
  };

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
      runtime: {
        sendMessage: vi.fn(async () => ({ payload: null })),
        getManifest: vi.fn(() => ({ version: '1.0.4' })),
      },
    });
    vi.stubGlobal('alert', vi.fn());
    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.spyOn(crashRecovery, 'saveOperationState').mockResolvedValue();
    vi.spyOn(crashRecovery, 'clearOperationState').mockResolvedValue();
    vi.spyOn(BatchExecutor.prototype, 'getState').mockReturnValue(ExecutorState.COMPLETED);
  });

  it('stores a diagnostic snapshot and exposes ready state after failed execution', async () => {
    const results: BatchResults = {
      success: [],
      failed: [
        {
          fileId: 'file-1',
          file,
          error: 'network error',
          index: 0,
        },
      ],
    };
    vi.spyOn(BatchExecutor.prototype, 'execute').mockResolvedValue(results);

    const panel = new FileSelectorPanel() as FileSelectorPanelDiagnosticHarness;
    panel.adapter = new DiagnosticTestAdapter();
    panel.allFiles = [file];
    panel.uncheckList = new Set();
    panel.extractErrorMap = new Map();
    panel.newNameMap = new Map([['file-1', 'new-a.txt']]);

    await panel.handleExecute();

    expect(panel.diagnosticPromptState).toBe('ready');
    expect(panel.diagnosticFailureCount).toBe(1);
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        [DIAGNOSTIC_STORAGE_KEYS.LAST_FAILURE]: expect.objectContaining({
          summary: expect.objectContaining({
            failed: 1,
            platform: 'quark',
          }),
          failures: [
            expect.objectContaining({
              fileId: 'file-1',
              originalName: 'old-a.txt',
              targetName: 'new-a.txt',
              errorMessage: 'network error',
            }),
          ],
        }),
      })
    );
  });

  it('downloads diagnostic payload and transitions to exported state', async () => {
    const payload: DiagnosticExportPayload = {
      exportedAt: 1710000001000,
      lastFailure: {
        failure: {
          id: 'failure-1',
          occurredAt: 1710000001000,
          reason: 'batch-execution-failed',
          message: '1 file failed',
        },
        summary: {
          platform: 'quark',
          total: 1,
          success: 0,
          failed: 1,
          retried: 0,
          startedAt: 1710000000000,
          finishedAt: 1710000001000,
        },
        failures: [
          {
            fileId: 'file-1',
            originalName: 'old-a.txt',
            targetName: 'new-a.txt',
            errorMessage: 'network error',
            attempt: 1,
          },
        ],
        recentLogs: [],
      },
      logs: [],
    };

    (URL as typeof URL & {
      createObjectURL?: ReturnType<typeof vi.fn>;
      revokeObjectURL?: ReturnType<typeof vi.fn>;
    }).createObjectURL = vi.fn(() => 'blob:diagnostic');
    (URL as typeof URL & {
      createObjectURL?: ReturnType<typeof vi.fn>;
      revokeObjectURL?: ReturnType<typeof vi.fn>;
    }).revokeObjectURL = vi.fn(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ payload });

    const panel = new FileSelectorPanel() as FileSelectorPanelDiagnosticHarness;
    panel.adapter = new DiagnosticTestAdapter();
    panel.diagnosticPromptState = 'ready';
    panel.diagnosticFailureCount = 1;

    await panel.handleDiagnosticExport();

    expect(chrome.runtime.sendMessage).toHaveBeenCalled();
    expect(panel.diagnosticPromptState).toBe('exported');
    expect(panel.diagnosticFileName).toMatch(/^cloud-drive-renamer-diagnostic-\d{4}-\d{2}-\d{2}-\d{4}\.json$/);
    expect(panel.diagnosticErrorMessage).toBeNull();
  });
});
