import { describe, expect, it } from 'vitest';
import { ConfigPanel } from '../../src/content/components/config-panel';

describe('ConfigPanel diagnostic feedback', () => {
  it('renders diagnostic ready prompt when finished with failures', async () => {
    const panel = new ConfigPanel() as ConfigPanel & {
      diagnosticPromptState: string;
      diagnosticFailureCount: number;
    };
    panel.finished = true;
    panel.progress = {
      completed: 2,
      total: 2,
      currentFile: '',
      success: 0,
      failed: 2,
    };
    panel.diagnosticPromptState = 'ready';
    panel.diagnosticFailureCount = 2;

    document.body.appendChild(panel);
    await panel.updateComplete;

    const exportButton = panel.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-role="diagnostic-export-button"]'
    );
    const dismissButton = panel.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-role="diagnostic-dismiss-button"]'
    );

    expect(exportButton).toBeTruthy();
    expect(dismissButton).toBeTruthy();

    panel.remove();
  });

  it('renders exported feedback actions and dispatches action events', async () => {
    const panel = new ConfigPanel() as ConfigPanel & {
      diagnosticPromptState: string;
      diagnosticFailureCount: number;
      diagnosticFileName: string | null;
    };
    panel.finished = true;
    panel.progress = {
      completed: 3,
      total: 3,
      currentFile: '',
      success: 1,
      failed: 2,
    };
    panel.diagnosticPromptState = 'exported';
    panel.diagnosticFailureCount = 2;
    panel.diagnosticFileName = 'cloud-drive-renamer-diagnostic-2026-03-20-1010.json';

    document.body.appendChild(panel);
    await panel.updateComplete;

    const events: string[] = [];
    panel.addEventListener('diagnostic-feedback-github', () => events.push('github'));
    panel.addEventListener('diagnostic-feedback-email', () => events.push('email'));
    panel.addEventListener('diagnostic-copy', () => events.push('copy'));
    panel.addEventListener('diagnostic-dismiss', () => events.push('dismiss'));

    const githubButton = panel.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-role="diagnostic-feedback-github"]'
    );
    const emailButton = panel.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-role="diagnostic-feedback-email"]'
    );
    const copyButton = panel.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-role="diagnostic-copy-button"]'
    );
    const dismissButton = panel.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-role="diagnostic-dismiss-button"]'
    );

    expect(githubButton).toBeTruthy();
    expect(emailButton).toBeTruthy();
    expect(copyButton).toBeTruthy();
    expect(dismissButton).toBeTruthy();

    githubButton?.click();
    emailButton?.click();
    copyButton?.click();
    dismissButton?.click();

    expect(events).toEqual(['github', 'email', 'copy', 'dismiss']);

    panel.remove();
  });
});
