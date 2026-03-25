import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RuleConfig } from '../../src/types/rule';
import {
  buildRulePresetSummary,
  createRulePresetId,
  deleteTemplateRulePreset,
  getRecentRulePresets,
  getTemplateRulePresets,
  isRulePresetConfigValid,
  recordRecentRulePreset,
  renameTemplateRulePreset,
  RULE_PRESET_STORAGE_KEYS,
  saveTemplateRulePreset,
} from '../../src/utils/rule-presets';
import { DEFAULT_EPISODE_EXTRACT_ASSIST_STATE } from '../../src/types/rule-preset';

const recentRecords = new Map<string, unknown>();

function createConfig(overrides?: Partial<RuleConfig>): RuleConfig {
  return {
    type: 'prefix',
    params: { prefix: 'Show', separator: '.' },
    ...overrides,
  };
}

describe('rule preset utilities', () => {
  beforeEach(() => {
    recentRecords.clear();
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          set: vi.fn(async (items: Record<string, unknown>) => {
            Object.entries(items).forEach(([key, value]) => recentRecords.set(key, value));
          }),
          get: vi.fn(async (key: string | null) => {
            if (key === null) {
              return Object.fromEntries(recentRecords.entries());
            }
            return { [key]: recentRecords.get(key) };
          }),
          remove: vi.fn(async (key: string) => {
            recentRecords.delete(key);
          }),
          clear: vi.fn(async () => {
            recentRecords.clear();
          }),
        },
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
  });

  it('provides default episode extract assist state', () => {
    expect(DEFAULT_EPISODE_EXTRACT_ASSIST_STATE.fillTarget).toBe('prefix');
    expect(DEFAULT_EPISODE_EXTRACT_ASSIST_STATE.fillMode).toBe('full-name');
    expect(DEFAULT_EPISODE_EXTRACT_ASSIST_STATE.sampleFileId).toBeNull();
  });

  it('creates unique-ish preset ids', () => {
    const first = createRulePresetId();
    const second = createRulePresetId();
    expect(first).not.toBe(second);
    expect(first).toContain('rule-preset-');
  });

  it('records recent presets, keeps newest first, deduplicates and limits to 8', async () => {
    const baseConfigs = Array.from({ length: 9 }, (_, index) =>
      createConfig({ params: { prefix: `Show-${index}`, separator: '.' } })
    );

    for (const config of baseConfigs) {
      await recordRecentRulePreset(config);
    }

    let recents = await getRecentRulePresets();
    expect(recents).toHaveLength(8);
    expect(recents[0].config.params.prefix).toBe('Show-8');
    expect(recents.at(-1)?.config.params.prefix).toBe('Show-1');

    await recordRecentRulePreset(baseConfigs[3]);
    recents = await getRecentRulePresets();
    expect(recents).toHaveLength(8);
    expect(recents[0].config.params.prefix).toBe('Show-3');
  });

  it('saves and deletes named template presets', async () => {
    const config = createConfig();
    const saved = await saveTemplateRulePreset('日剧模板', config);

    expect(saved.record.name).toBe('日剧模板');
    expect(saved.replaced).toBe(false);

    let templates = await getTemplateRulePresets();
    expect(templates).toHaveLength(1);
    expect(templates[0].name).toBe('日剧模板');

    await deleteTemplateRulePreset(saved.record.id);
    templates = await getTemplateRulePresets();
    expect(templates).toHaveLength(0);
  });

  it('supports overwriting named templates', async () => {
    const first = await saveTemplateRulePreset('通用模板', createConfig());
    const secondConfig = createConfig({ params: { prefix: 'Show-Updated', separator: '_' } });

    const overwritten = await saveTemplateRulePreset('通用模板', secondConfig, { overwriteName: true });

    expect(overwritten.replaced).toBe(true);
    const templates = await getTemplateRulePresets();
    expect(templates).toHaveLength(1);
    expect(templates[0].id).toBe(first.record.id);
    expect(templates[0].config.params.prefix).toBe('Show-Updated');
  });


  it('renames template presets and supports overwrite by target id', async () => {
    const first = await saveTemplateRulePreset('旧模板名', createConfig());
    await saveTemplateRulePreset('已存在模板', createConfig({ params: { prefix: 'Other', separator: '-' } }));

    const renamed = await renameTemplateRulePreset(first.record.id, '新模板名');
    expect(renamed.record.id).toBe(first.record.id);
    expect(renamed.record.name).toBe('新模板名');
    expect(renamed.replaced).toBe(false);

    await expect(renameTemplateRulePreset(first.record.id, '已存在模板')).rejects.toThrow('Template name already exists');

    const overwritten = await renameTemplateRulePreset(first.record.id, '已存在模板', { overwriteName: true });
    expect(overwritten.record.id).toBe(first.record.id);
    expect(overwritten.record.name).toBe('已存在模板');
    expect(overwritten.replaced).toBe(true);

    const templates = await getTemplateRulePresets();
    expect(templates).toHaveLength(1);
    expect(templates[0].id).toBe(first.record.id);
    expect(templates[0].name).toBe('已存在模板');
  });

  it('rejects duplicate template names unless overwrite is explicitly enabled', async () => {
    await saveTemplateRulePreset('通用模板', createConfig());

    await expect(
      saveTemplateRulePreset('通用模板', createConfig({ params: { prefix: 'Other', separator: '-' } }))
    ).rejects.toThrow('Template name already exists');

    const templates = await getTemplateRulePresets();
    expect(templates).toHaveLength(1);
    expect(templates[0].config.params.prefix).toBe('Show');
  });

  it('builds readable summaries for supported rule types', () => {
    expect(buildRulePresetSummary(createConfig())).toContain('Prefix');
    expect(
      buildRulePresetSummary({ type: 'episodeExtract', params: { template: '{prefix}.S{season}E{episode}{ext}' } })
    ).toContain('Episode');
  });

  it('validates only currently supported rule configs', () => {
    expect(isRulePresetConfigValid(createConfig())).toBe(true);
    expect(
      isRulePresetConfigValid({ type: 'replace', params: { search: '', replace: '' } })
    ).toBe(false);
  });

  it('uses expected storage keys', () => {
    expect(RULE_PRESET_STORAGE_KEYS.recent).toBe('rulePresets.recent');
    expect(RULE_PRESET_STORAGE_KEYS.templates).toBe('rulePresets.templates');
  });
});
