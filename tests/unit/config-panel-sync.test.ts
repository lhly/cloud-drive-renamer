import { afterEach, describe, expect, it } from 'vitest';
import { ConfigPanel } from '../../src/content/components/config-panel';
import { I18nService } from '../../src/utils/i18n';

afterEach(() => document.body.replaceChildren());

describe('ConfigPanel page sync feedback', () => {
  it('shows manual refresh as a localized notice without a failed state or retry action', async () => {
    const panel = new ConfigPanel();
    panel.finished = true;
    panel.syncSupported = true;
    panel.syncStatus = 'refresh-required';
    document.body.append(panel);
    await panel.updateComplete;

    const status = panel.shadowRoot!.querySelector('.sync-status');
    expect(status?.textContent?.trim()).toBe(I18nService.t('sync_manual_refresh'));
    expect(status?.classList.contains('failed')).toBe(false);
    expect(panel.shadowRoot!.querySelector('.sync-retry')).toBeNull();
  });

  it('keeps genuine sync errors visible and retryable', async () => {
    const panel = new ConfigPanel();
    panel.finished = true;
    panel.syncSupported = true;
    panel.syncStatus = 'failed';
    panel.syncMessage = 'Network error';
    document.body.append(panel);
    await panel.updateComplete;

    expect(panel.shadowRoot!.querySelector('.sync-status.failed')?.textContent).toContain('Network error');
    const retry = panel.shadowRoot!.querySelector<HTMLButtonElement>('.sync-retry');
    expect(retry).not.toBeNull();
    const events: Event[] = [];
    panel.addEventListener('sync', (event) => events.push(event));
    retry!.click();
    expect(events).toHaveLength(1);
  });
});
