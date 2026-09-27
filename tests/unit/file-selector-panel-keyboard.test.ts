import { afterEach, describe, expect, it, vi } from 'vitest';
import { FileSelectorPanel } from '../../src/content/components/file-selector-panel';
import { Toolbar } from '../../src/content/components/toolbar';

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

async function mountPanel() {
  const panel = new FileSelectorPanel();
  document.body.append(panel);
  await panel.updateComplete;
  const nested = document.createElement('div');
  const root = nested.attachShadow({ mode: 'open' });
  const input = document.createElement('input');
  root.append(input);
  panel.shadowRoot!.append(nested);
  return { panel, root, input };
}

describe('FileSelectorPanel keyboard boundary', () => {
  it.each(['keydown', 'keypress', 'keyup'])('contains %s without cancelling native input or child handlers', async (type) => {
    const { input } = await mountPanel();
    const onPage = vi.fn();
    const onInput = vi.fn();
    document.addEventListener(type, onPage);
    input.addEventListener(type, onInput);
    try {
      for (const args of [{ key: 'a' }, { key: 'v', ctrlKey: true }, { key: 'Tab' }, { key: 'Process', isComposing: true }]) {
        const event = new KeyboardEvent(type, { ...args, bubbles: true, composed: true, cancelable: true });
        expect(input.dispatchEvent(event)).toBe(true);
        expect(event.defaultPrevented).toBe(false);
      }
      expect(onInput).toHaveBeenCalledTimes(4);
      expect(onPage).not.toHaveBeenCalled();
      document.body.dispatchEvent(new KeyboardEvent(type, { key: 'a', bubbles: true }));
      expect(onPage).toHaveBeenCalledTimes(1);
    } finally {
      document.removeEventListener(type, onPage);
    }
  });

  it('keeps the toolbar Escape action inside the panel and restores its button focus', async () => {
    const { root } = await mountPanel();
    const toolbar = new Toolbar();
    root.append(toolbar);
    await toolbar.updateComplete;
    const button = toolbar.shadowRoot!.querySelector<HTMLButtonElement>('#type-filter-button')!;
    button.click();
    await toolbar.updateComplete;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true, cancelable: true });
    button.dispatchEvent(event);
    await toolbar.updateComplete;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(event.defaultPrevented).toBe(true);
    expect(toolbar.shadowRoot!.activeElement).toBe(button);
  });

  it('removes the boundary listener on disconnect and reinstalls it on reconnect', async () => {
    const { panel, input } = await mountPanel();
    panel.remove();
    const detached = new KeyboardEvent('keydown', { bubbles: true, composed: true });
    const stop = vi.spyOn(detached, 'stopPropagation');
    input.dispatchEvent(detached);
    expect(stop).not.toHaveBeenCalled();
    document.body.append(panel);
    const reattached = new KeyboardEvent('keydown', { bubbles: true, composed: true });
    const stopAgain = vi.spyOn(reattached, 'stopPropagation');
    input.dispatchEvent(reattached);
    expect(stopAgain).toHaveBeenCalledTimes(1);
  });
});
