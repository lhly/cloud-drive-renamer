import { describe, expect, it } from 'vitest';
import { ConfigPanel } from '../../src/content/components/config-panel';

describe('ConfigPanel episode extract assist', () => {
  it('renders assist section for episode extract and dispatches assist events', async () => {
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
    panel.episodeExtractAssistState = {
      sampleFileId: 'file-1',
      sampleFileName: 'Show.S01E01',
      fillTarget: 'prefix',
      fillMode: 'full-name',
      suggestedFailureFileId: 'file-2',
    };
    panel.episodeExtractFailureCount = 2;

    document.body.appendChild(panel);
    await panel.updateComplete;
    await panel.updateComplete;

    expect(panel.shadowRoot?.querySelector('[data-role="episode-assist-random"]')).toBeTruthy();
    expect(panel.shadowRoot?.querySelector('[data-role="episode-assist-failures"]')?.textContent).toContain('2');

    const targetEvents: Array<CustomEvent<{ target: string }>> = [];
    const modeEvents: Array<CustomEvent<{ mode: string }>> = [];
    const firstFailureEvents: Event[] = [];
    const clearEvents: Event[] = [];
    panel.addEventListener('episode-assist-change-target', (event) => targetEvents.push(event as CustomEvent<{ target: string }>));
    panel.addEventListener('episode-assist-change-mode', (event) => modeEvents.push(event as CustomEvent<{ mode: string }>));
    panel.addEventListener('episode-assist-use-first-failure', (event) => firstFailureEvents.push(event));
    panel.addEventListener('episode-assist-clear-sample', (event) => clearEvents.push(event));

    panel.shadowRoot
      ?.querySelector<HTMLElement>('[data-role="episode-assist-target-helperPre"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    panel.shadowRoot
      ?.querySelector<HTMLElement>('[data-role="episode-assist-mode-segment"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    panel.shadowRoot
      ?.querySelector<HTMLElement>('[data-role="episode-assist-first-failure"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    panel.shadowRoot
      ?.querySelector<HTMLElement>('[data-role="episode-assist-clear-sample"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

    expect(targetEvents).toHaveLength(1);
    expect(targetEvents[0].detail.target).toBe('helperPre');
    expect(modeEvents).toHaveLength(1);
    expect(modeEvents[0].detail.mode).toBe('segment');
    expect(firstFailureEvents).toHaveLength(1);
    expect(clearEvents).toHaveLength(1);

    panel.remove();
  });
});
