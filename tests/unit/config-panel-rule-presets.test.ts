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
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('uses a compact flat toolbar for main tabs', () => {
    const cssText = ConfigPanel.styles.cssText;
    const toolbarRule = cssText.slice(cssText.indexOf('.preset-toolbar'), cssText.indexOf('.preset-tablist'));
    const tablistRule = cssText.slice(cssText.indexOf('.preset-tablist'), cssText.indexOf('.preset-tab {'));
    const tabRule = cssText.slice(cssText.indexOf('.preset-tab {'), cssText.indexOf('.preset-tab.selected'));

    expect(toolbarRule).toContain('height: 48px;');
    expect(toolbarRule).toContain('border-top: 1px solid var(--cdr-border');
    expect(toolbarRule).toContain('border-right: 1px solid var(--cdr-border');
    expect(toolbarRule).toContain('border-left: 1px solid var(--cdr-border');
    expect(tablistRule).not.toContain('padding: 4px;');
    expect(tablistRule).not.toContain('background: var(--cdr-surface-muted');
    expect(tabRule).toContain('padding: 4px 8px;');
    expect(tabRule).toContain('min-height: 28px;');
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

  it('keeps config as the default tab and switches back there after applying a preset', async () => {
    const panel = new ConfigPanel();
    panel.recentRulePresets = [
      createPreset({
        id: 'recent-1',
        source: 'recent',
        name: '最近规则',
        config: {
          type: 'regex',
          params: {
            pattern: '^S(\\d+)',
            replace: 'Season $1',
            caseSensitive: false,
            global: true,
            flags: '',
            includeExtension: false,
          },
        },
      }),
    ];
    panel.templateRulePresets = [
      createPreset({ id: 'template-1', source: 'template', name: '我的模板' }),
    ];

    document.body.appendChild(panel);
    await panel.updateComplete;

    const configTab = panel.shadowRoot?.querySelector<HTMLButtonElement>('[data-role="preset-tab-config"]');
    const recentTab = panel.shadowRoot?.querySelector<HTMLButtonElement>('[data-role="preset-tab-recent"]');
    const templateTab = panel.shadowRoot?.querySelector<HTMLButtonElement>('[data-role="preset-tab-template"]');

    expect(configTab?.getAttribute('aria-selected')).toBe('true');
    expect(recentTab?.getAttribute('aria-selected')).toBe('false');
    expect(templateTab?.getAttribute('aria-selected')).toBe('false');
    expect(panel.shadowRoot?.querySelector('[data-role="preset-toolbar"]')).toBeTruthy();
    expect(panel.shadowRoot?.querySelector<HTMLDivElement>('#preset-panel-config')?.hidden).toBe(false);
    expect(panel.shadowRoot?.querySelector<HTMLDivElement>('#preset-panel-recent')?.hidden).toBe(true);
    expect(panel.shadowRoot?.querySelector<HTMLDivElement>('#preset-panel-templates')?.hidden).toBe(true);
    expect(panel.shadowRoot?.querySelector('[data-role="save-template-button"]')).toBeNull();

    recentTab?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await panel.updateComplete;

    expect(configTab?.getAttribute('aria-selected')).toBe('false');
    expect(recentTab?.getAttribute('aria-selected')).toBe('true');
    expect(panel.shadowRoot?.querySelector<HTMLDivElement>('#preset-panel-config')?.hidden).toBe(true);
    expect(panel.shadowRoot?.querySelector<HTMLDivElement>('#preset-panel-recent')?.hidden).toBe(false);

    const applyEvents: Array<CustomEvent<{ presetId: string }>> = [];
    const saveEvents: Array<CustomEvent<{ name: string }>> = [];
    const renameEvents: Array<CustomEvent<{ presetId: string; name: string }>> = [];
    const deleteEvents: Array<CustomEvent<{ presetId: string }>> = [];
    panel.addEventListener('apply-rule-preset', (event) => applyEvents.push(event as CustomEvent<{ presetId: string }>));
    panel.addEventListener('save-rule-template', (event) => saveEvents.push(event as CustomEvent<{ name: string }>));
    panel.addEventListener('rename-rule-template', (event) => renameEvents.push(event as CustomEvent<{ presetId: string; name: string }>));
    panel.addEventListener('delete-rule-template', (event) => deleteEvents.push(event as CustomEvent<{ presetId: string }>));

    panel.shadowRoot
      ?.querySelector<HTMLElement>('[data-preset-id="recent-1"] [data-role="apply-rule-preset"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await panel.updateComplete;

    expect(applyEvents).toHaveLength(1);
    expect(applyEvents[0].detail.presetId).toBe('recent-1');
    expect(configTab?.getAttribute('aria-selected')).toBe('true');
    expect(recentTab?.getAttribute('aria-selected')).toBe('false');
    expect(panel.shadowRoot?.querySelector<HTMLDivElement>('#preset-panel-config')?.hidden).toBe(false);
    expect(panel.shadowRoot?.querySelector<HTMLDivElement>('#preset-panel-recent')?.hidden).toBe(true);

    const saveButton = panel.shadowRoot?.querySelector<HTMLButtonElement>('[data-role="save-template-button"]');
    expect(saveButton).toBeTruthy();
    expect(saveButton?.closest('[data-rule-panel-type="regex"]')).toBeTruthy();
    expect(panel.shadowRoot?.querySelector<HTMLInputElement>('[data-rule-panel-type="regex"] .form-input')?.value).toBe('^S(\\d+)');

    saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

    templateTab?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await panel.updateComplete;

    expect(templateTab?.getAttribute('aria-selected')).toBe('true');
    expect(panel.shadowRoot?.querySelector<HTMLDivElement>('#preset-panel-templates')?.hidden).toBe(false);
    expect(panel.shadowRoot?.querySelector<HTMLDivElement>('#preset-panel-templates')?.querySelector('[data-role="save-template-button"]')).toBeNull();

    vi.mocked(prompt).mockReturnValueOnce('重命名模板');
    panel.shadowRoot
      ?.querySelector<HTMLElement>('[data-preset-id="template-1"] [data-role="rename-rule-template"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    panel.shadowRoot
      ?.querySelector<HTMLElement>('[data-preset-id="template-1"] [data-role="delete-rule-template"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

    expect(saveEvents).toHaveLength(1);
    expect(saveEvents[0].detail.name).toBe('剧集模板');
    expect(renameEvents).toHaveLength(1);
    expect(renameEvents[0].detail.presetId).toBe('template-1');
    expect(renameEvents[0].detail.name).toBe('重命名模板');
    expect(deleteEvents).toHaveLength(1);
    expect(deleteEvents[0].detail.presetId).toBe('template-1');

    panel.remove();
  });

  it('does not render rename action for recent presets', async () => {
    const panel = new ConfigPanel();
    panel.recentRulePresets = [
      createPreset({ id: 'recent-only', source: 'recent', name: '最近规则' }),
    ];

    document.body.appendChild(panel);
    await panel.updateComplete;

    expect(
      panel.shadowRoot?.querySelector('[data-preset-id="recent-only"] [data-role="rename-rule-template"]')
    ).toBeNull();

    panel.remove();
  });

});
