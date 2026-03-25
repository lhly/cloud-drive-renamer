import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigPanel } from '../../src/content/components/config-panel';
import type { RulePresetRecord } from '../../src/types/rule-preset';

function createPreset(overrides: Partial<RulePresetRecord>): RulePresetRecord {
  return {
    id: 'preset-id',
    config: {
      type: 'prefix',
      params: { prefix: 'Show', separator: '.' },
    },
    createdAt: 1,
    updatedAt: 1,
    source: 'recent',
    ...overrides,
  };
}

describe('ConfigPanel rule preset interactions', () => {
  beforeEach(() => {
    vi.stubGlobal('prompt', vi.fn(() => '剧集模板'));
  });

  it('marks invalid presets as disabled and does not dispatch apply events', async () => {
    const panel = new ConfigPanel();
    panel.recentRulePresets = [
      createPreset({
        id: 'invalid-1',
        source: 'recent',
        name: '失效模板',
        config: { type: 'replace', params: { search: '', replace: '' } },
      }),
    ];

    const applyEvents: Array<Event> = [];
    panel.addEventListener('apply-rule-preset', (event) => applyEvents.push(event));

    document.body.appendChild(panel);
    await panel.updateComplete;

    const applyButton = panel.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-preset-id="invalid-1"] [data-role="apply-rule-preset"]'
    );
    const badgeText = panel.shadowRoot?.querySelector('[data-preset-id="invalid-1"] .preset-invalid-badge')?.textContent ?? '';

    expect(applyButton?.disabled).toBe(true);
    expect(badgeText).toContain('失效');

    applyButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    expect(applyEvents).toHaveLength(0);

    panel.remove();
  });

  it('renders recent/templates and dispatches apply, save, delete events', async () => {
    const panel = new ConfigPanel();
    panel.activeRuleConfig = {
      type: 'episodeExtract',
      params: {
        template: '{prefix}.S{season}E{episode}{ext}',
        prefix: '',
        season: 1,
        offset: 0,
        leadingZeroCount: 2,
        helperPre: '',
        helperPost: '',
      },
    };
    panel.recentRulePresets = [
      createPreset({ id: 'recent-1', source: 'recent', name: '最近规则' }),
    ];
    panel.templateRulePresets = [
      createPreset({ id: 'template-1', source: 'template', name: '我的模板' }),
    ];

    document.body.appendChild(panel);
    await panel.updateComplete;

    const text = panel.shadowRoot?.textContent ?? '';
    expect(text).toContain('最近规则');
    expect(text).toContain('我的模板');

    const applyEvents: Array<CustomEvent<{ presetId: string }>> = [];
    const saveEvents: Array<CustomEvent<{ name: string }>> = [];
    const deleteEvents: Array<CustomEvent<{ presetId: string }>> = [];
    panel.addEventListener('apply-rule-preset', (event) => applyEvents.push(event as CustomEvent<{ presetId: string }>));
    panel.addEventListener('save-rule-template', (event) => saveEvents.push(event as CustomEvent<{ name: string }>));
    panel.addEventListener('delete-rule-template', (event) => deleteEvents.push(event as CustomEvent<{ presetId: string }>));

    panel.shadowRoot
      ?.querySelector<HTMLElement>('[data-preset-id="recent-1"] [data-role="apply-rule-preset"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    panel.shadowRoot
      ?.querySelector<HTMLElement>('[data-role="save-template-button"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    panel.shadowRoot
      ?.querySelector<HTMLElement>('[data-preset-id="template-1"] [data-role="delete-rule-template"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

    expect(applyEvents).toHaveLength(1);
    expect(applyEvents[0].detail.presetId).toBe('recent-1');
    expect(saveEvents).toHaveLength(1);
    expect(saveEvents[0].detail.name).toBe('剧集模板');
    expect(deleteEvents).toHaveLength(1);
    expect(deleteEvents[0].detail.presetId).toBe('template-1');

    panel.remove();
  });
});
