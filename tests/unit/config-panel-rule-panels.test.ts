import { describe, expect, it, vi } from 'vitest';
import { ConfigPanel } from '../../src/content/components/config-panel';

describe('ConfigPanel rule panels', () => {
  it('removes collapsed panel bodies from layout so headers stay compact', () => {
    const cssText = ConfigPanel.styles.cssText;

    expect(cssText).toContain('.rule-panel-body[hidden]');
    expect(cssText).toContain('display: none;');
    expect(cssText).not.toContain('grid-template-rows: 0fr;');
  });

  it('keeps every rule panel collapsed when an active rule config is provided initially', async () => {
    const panel = new ConfigPanel();
    panel.activeRuleConfig = {
      type: 'prefix',
      params: { prefix: 'My Show', separator: '.' },
    };

    document.body.appendChild(panel);
    await panel.updateComplete;

    const expandedHeaders = panel.shadowRoot?.querySelectorAll('[aria-expanded="true"]') ?? [];
    const prefixBody = panel.shadowRoot?.querySelector<HTMLElement>('#rule-panel-body-prefix');
    const prefixInput = panel.shadowRoot?.querySelector<HTMLInputElement>('#rule-panel-body-prefix .form-input');

    expect(expandedHeaders).toHaveLength(0);
    expect(prefixBody?.hidden).toBe(true);
    expect(prefixInput).toBeNull();

    panel.remove();
  });

  it('keeps the active rule configuration when the expanded header is collapsed and reopened', async () => {
    const panel = new ConfigPanel();
    panel.activeRuleConfig = {
      type: 'prefix',
      params: { prefix: 'My Show', separator: '.' },
    };

    document.body.appendChild(panel);
    await panel.updateComplete;

    const configEvents: Array<CustomEvent> = [];
    panel.addEventListener('config-change', (event) => configEvents.push(event as CustomEvent));

    const header = panel.shadowRoot?.querySelector<HTMLButtonElement>(
      '[aria-controls="rule-panel-body-prefix"]'
    );
    expect(header?.getAttribute('aria-expanded')).toBe('false');

    header?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await panel.updateComplete;

    const expandedHeader = panel.shadowRoot?.querySelector<HTMLButtonElement>(
      '[aria-controls="rule-panel-body-prefix"]'
    );
    const expandedInput = panel.shadowRoot?.querySelector<HTMLInputElement>(
      '#rule-panel-body-prefix .form-input'
    );

    expect(expandedHeader?.getAttribute('aria-expanded')).toBe('true');
    expect(expandedInput?.value).toBe('My Show');

    expandedHeader?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await panel.updateComplete;

    const collapsedHeader = panel.shadowRoot?.querySelector<HTMLButtonElement>(
      '[aria-controls="rule-panel-body-prefix"]'
    );
    expect(collapsedHeader?.getAttribute('aria-expanded')).toBe('false');
    expect(panel.shadowRoot?.querySelector('#rule-panel-body-prefix .form-input')).toBeNull();

    collapsedHeader?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await panel.updateComplete;

    const reopenedHeader = panel.shadowRoot?.querySelector<HTMLButtonElement>(
      '[aria-controls="rule-panel-body-prefix"]'
    );
    const reopenedInput = panel.shadowRoot?.querySelector<HTMLInputElement>(
      '#rule-panel-body-prefix .form-input'
    );

    expect(reopenedHeader?.getAttribute('aria-expanded')).toBe('true');
    expect(reopenedInput?.value).toBe('My Show');
    expect(configEvents).toHaveLength(0);

    panel.remove();
  });

  it('scrolls the left panel body to keep a newly expanded rule visible', async () => {
    const panel = new ConfigPanel();

    document.body.appendChild(panel);
    await panel.updateComplete;

    const panelBody = panel.shadowRoot?.querySelector<HTMLElement>('.panel-body');
    const numberingPanel = panel.shadowRoot?.querySelector<HTMLElement>('[data-rule-panel-type="numbering"]');
    const numberingHeader = panel.shadowRoot?.querySelector<HTMLButtonElement>(
      '[aria-controls="rule-panel-body-numbering"]'
    );
    expect(panelBody).toBeTruthy();
    expect(numberingPanel).toBeTruthy();
    expect(numberingHeader).toBeTruthy();

    Object.defineProperty(panelBody, 'clientHeight', { value: 300, configurable: true });
    panelBody!.scrollTop = 320;
    panelBody!.getBoundingClientRect = () => ({
      top: 100,
      bottom: 400,
      left: 0,
      right: 320,
      width: 320,
      height: 300,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });
    numberingPanel!.getBoundingClientRect = () => ({
      top: 50,
      bottom: 650,
      left: 0,
      right: 320,
      width: 320,
      height: 600,
      x: 0,
      y: 50,
      toJSON: () => ({}),
    });
    const scrollTo = vi.fn();
    panelBody!.scrollTo = scrollTo;

    numberingHeader?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await panel.updateComplete;
    await panel.updateComplete;

    expect(scrollTo).toHaveBeenCalledWith({ top: 262, behavior: 'smooth' });

    panel.remove();
  });
});
