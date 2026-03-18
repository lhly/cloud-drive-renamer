import { describe, expect, it } from 'vitest';
import { ConfigPanel } from '../../src/content/components/config-panel';

describe('ConfigPanel undo action', () => {
  it('uses balanced footer styles so execute button is compact and disabled undo stays visible', () => {
    const cssText = ConfigPanel.styles.cssText;
    const actionGroupRule = cssText.slice(cssText.indexOf('.execution-actions-main'), cssText.indexOf('.rule-selector'));
    const footerButtonRule = cssText.slice(cssText.indexOf('.execution-actions .button'), cssText.indexOf('.button-icon:disabled'));
    const disabledUndoRule = cssText.slice(cssText.indexOf('.button-icon:disabled'), cssText.indexOf('@keyframes cdr-undo-spin'));

    expect(actionGroupRule).toContain('flex: 0 1 auto;');
    expect(actionGroupRule).toContain('max-width: 100%;');
    expect(footerButtonRule).toContain('flex: 0 0 auto;');
    expect(footerButtonRule).toContain('min-width: 96px;');
    expect(footerButtonRule).not.toContain('flex: 1;');
    expect(cssText).toContain('.button-execute');
    expect(cssText).toContain('min-width: 136px;');
    expect(cssText).toContain('padding: 10px 14px;');
    expect(disabledUndoRule).toContain('background: var(--cdr-surface-muted, #fafafa);');
    expect(disabledUndoRule).toContain('border-color: var(--cdr-border, #f0f0f0);');
    expect(disabledUndoRule).toContain('opacity: 0.72;');
    expect(disabledUndoRule).not.toContain('background: transparent;');
  });

  it('renders undo button in finished view and dispatches undo event on click', async () => {
    const panel = new ConfigPanel();
    panel.finished = true;
    panel.canUndo = true;
    panel.undoBusy = false;
    panel.progress = {
      completed: 1,
      total: 1,
      currentFile: '',
      success: 1,
      failed: 0,
    };

    document.body.appendChild(panel);
    await panel.updateComplete;

    const events: Event[] = [];
    panel.addEventListener('undo', (event) => events.push(event));

    const undoButton = panel.shadowRoot?.querySelector<HTMLButtonElement>('[data-role="undo-icon-button"]');

    expect(undoButton).toBeTruthy();
    expect(undoButton?.hasAttribute('disabled')).toBe(false);
    expect(undoButton?.getAttribute('aria-label')).toBeTruthy();
    expect((undoButton?.textContent || '').trim()).toBe('');

    undoButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

    expect(events).toHaveLength(1);

    panel.remove();
  });

  it('renders undo button in normal config view when a valid undo record exists', async () => {
    const panel = new ConfigPanel();
    panel.finished = false;
    panel.executing = false;
    panel.canUndo = true;
    panel.undoBusy = false;
    panel.selectedCount = 2;
    panel.renameCount = 2;

    document.body.appendChild(panel);
    await panel.updateComplete;

    const undoButton = panel.shadowRoot?.querySelector<HTMLButtonElement>('[data-role="undo-icon-button"]');

    expect(undoButton).toBeTruthy();
    expect(undoButton?.getAttribute('aria-label')).toBeTruthy();
    expect((undoButton?.textContent || '').trim()).toBe('');

    panel.remove();
  });
});
