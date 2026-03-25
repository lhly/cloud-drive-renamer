import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileSelectorPanel } from '../../src/content/components/file-selector-panel';
import { BatchExecutor, ExecutorState } from '../../src/core/executor';
import { crashRecovery } from '../../src/core/crash-recovery';
import type { FileItem, PlatformAdapter, RenameResult } from '../../src/types/platform';
import * as rulePresets from '../../src/utils/rule-presets';

type FileSelectorPanelPresetHarness = FileSelectorPanel & {
  ruleConfig: any;
  allFiles: FileItem[];
  uncheckList: Set<string>;
  newNameMap: Map<string, string>;
  extractErrorMap: Map<string, string>;
  episodeExtractAssistState: any;
  recentRulePresets: any[];
  handleApplyRulePreset(event: CustomEvent<{ presetId: string }>): Promise<void>;
  handleExecute(): Promise<void>;
};

class PresetTestAdapter implements PlatformAdapter {
  readonly platform = 'aliyun' as const;

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
      name: `${fileId}.mkv`,
      ext: '.mkv',
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

describe('FileSelectorPanel rule preset integration', () => {
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
        sendMessage: vi.fn(async () => undefined),
      },
    });
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    });
    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.stubGlobal('alert', vi.fn());
    vi.stubGlobal('prompt', vi.fn(() => null));
    vi.spyOn(crashRecovery, 'saveOperationState').mockResolvedValue();
    vi.spyOn(crashRecovery, 'clearOperationState').mockResolvedValue();
    vi.spyOn(BatchExecutor.prototype, 'getState').mockReturnValue(ExecutorState.COMPLETED);
  });

  it('applies a preset config and resets assist state', async () => {
    const panel = new FileSelectorPanel() as FileSelectorPanelPresetHarness;
    vi.spyOn(rulePresets, 'getRulePresetById').mockResolvedValue({
      id: 'template-episode',
      name: '剧集模板',
      source: 'template',
      createdAt: 1,
      updatedAt: 1,
      config: {
        type: 'episodeExtract',
        params: {
          template: '{prefix}.S{season}E{episode}{ext}',
          prefix: 'Show',
          season: 2,
          offset: 1,
          leadingZeroCount: 2,
          helperPre: '第',
          helperPost: '集',
        },
      },
    });

    panel.episodeExtractAssistState = {
      sampleFileId: 'old',
      sampleFileName: 'old-sample',
      fillTarget: 'helperPost',
      fillMode: 'segment',
      suggestedFailureFileId: 'old',
    };

    await panel.handleApplyRulePreset(new CustomEvent('apply-rule-preset', { detail: { presetId: 'template-episode' } }));

    expect(panel.ruleConfig.type).toBe('episodeExtract');
    expect(panel.ruleConfig.params.prefix).toBe('Show');
    expect(panel.episodeExtractAssistState.sampleFileId).toBeNull();
    expect(panel.episodeExtractAssistState.fillTarget).toBe('prefix');
    expect(panel.episodeExtractAssistState.fillMode).toBe('full-name');
  });

  it('records recent presets after a successful execution', async () => {
    const panel = new FileSelectorPanel() as FileSelectorPanelPresetHarness;
    panel.adapter = new PresetTestAdapter();
    panel.ruleConfig = {
      type: 'prefix',
      params: { prefix: 'Renamed-', separator: '' },
    };
    panel.allFiles = [
      {
        id: 'file-1',
        name: 'episode-01.mkv',
        ext: '.mkv',
        parentId: 'root',
        size: 1,
        mtime: 1,
      },
    ];
    panel.uncheckList = new Set();
    panel.newNameMap = new Map([['file-1', 'Renamed-episode-01.mkv']]);
    panel.extractErrorMap = new Map();

    vi.spyOn(BatchExecutor.prototype, 'execute').mockResolvedValue({
      success: [
        {
          fileId: 'file-1',
          original: 'episode-01.mkv',
          renamed: 'Renamed-episode-01.mkv',
          index: 0,
        },
      ],
      failed: [],
    });
    const recentSpy = vi.spyOn(rulePresets, 'recordRecentRulePreset').mockResolvedValue([
      {
        id: 'recent-1',
        source: 'recent',
        createdAt: 1,
        updatedAt: 2,
        config: panel.ruleConfig,
      },
    ]);

    await panel.handleExecute();

    expect(recentSpy).toHaveBeenCalledWith(panel.ruleConfig);
    expect(panel.recentRulePresets).toHaveLength(1);
    expect(panel.recentRulePresets[0].id).toBe('recent-1');
  });
});
