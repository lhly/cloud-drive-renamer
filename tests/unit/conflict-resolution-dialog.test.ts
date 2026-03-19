import { describe, expect, it } from 'vitest';
import '../../src/content/components/conflict-resolution-dialog';
import { ConflictResolution, ConflictType } from '../../src/core/conflict-detector';

type ConflictResolutionDialogElement = HTMLElement & {
  open: boolean;
  conflictCount: number;
  items: Array<{
    fileId: string;
    originalName: string;
    targetName: string;
    type: ConflictType;
    conflictingFiles: string[];
  }>;
  updateComplete: Promise<void>;
};

describe('ConflictResolutionDialog', () => {
  it('renders a scrollable conflict list with original and target names', async () => {
    const element = document.createElement(
      'conflict-resolution-dialog'
    ) as ConflictResolutionDialogElement;
    element.open = true;
    element.conflictCount = 2;
    element.items = [
      {
        fileId: '1',
        originalName: 'old-a.txt',
        targetName: 'same.txt',
        type: ConflictType.DUPLICATE_IN_BATCH,
        conflictingFiles: ['old-a.txt', 'old-b.txt'],
      },
      {
        fileId: '2',
        originalName: 'old-c.txt',
        targetName: 'taken.txt',
        type: ConflictType.NAME_EXISTS,
        conflictingFiles: [],
      },
    ];

    document.body.appendChild(element);
    await element.updateComplete;

    const list = element.shadowRoot?.querySelector<HTMLElement>('[data-role="conflict-list"]');
    const rows = element.shadowRoot?.querySelectorAll<HTMLElement>('[data-role="conflict-row"]') || [];
    const cssText = customElements
      .get('conflict-resolution-dialog')
      // @ts-expect-error test reads static styles for scrollability contract
      ?.styles?.cssText as string;

    expect(list).toBeTruthy();
    expect(rows).toHaveLength(2);
    expect(rows[0]?.getAttribute('data-conflict-type')).toBe(ConflictType.DUPLICATE_IN_BATCH);
    expect(rows[1]?.getAttribute('data-conflict-type')).toBe(ConflictType.NAME_EXISTS);
    expect(element.shadowRoot?.textContent).toContain('old-a.txt');
    expect(element.shadowRoot?.textContent).toContain('same.txt');
    expect(element.shadowRoot?.textContent).toContain('old-c.txt');
    expect(element.shadowRoot?.textContent).toContain('taken.txt');
    expect(cssText).toContain('.conflict-list');
    expect(cssText).toContain('max-height: 240px;');
    expect(cssText).toContain('overflow-y: auto;');

    element.remove();
  });

  it('emits auto-number and skip actions, and emits close on cancel', async () => {
    const element = document.createElement(
      'conflict-resolution-dialog'
    ) as ConflictResolutionDialogElement;
    element.open = true;
    element.conflictCount = 1;
    element.items = [
      {
        fileId: '1',
        originalName: 'old-a.txt',
        targetName: 'same.txt',
        type: ConflictType.DUPLICATE_IN_BATCH,
        conflictingFiles: ['old-a.txt', 'old-b.txt'],
      },
    ];

    document.body.appendChild(element);
    await element.updateComplete;

    const resolutions: ConflictResolution[] = [];
    const closes: Event[] = [];
    element.addEventListener('conflict-dialog-resolve', ((event: Event) => {
      const customEvent = event as CustomEvent<{ resolution: ConflictResolution }>;
      resolutions.push(customEvent.detail.resolution);
    }) as EventListener);
    element.addEventListener('dialog-close', (event) => closes.push(event));

    const autoButton = element.shadowRoot?.querySelector<HTMLButtonElement>('[data-role="auto-number-button"]');
    const skipButton = element.shadowRoot?.querySelector<HTMLButtonElement>('[data-role="skip-button"]');
    const cancelButton = element.shadowRoot?.querySelector<HTMLButtonElement>('[data-role="cancel-button"]');

    autoButton?.click();
    skipButton?.click();
    cancelButton?.click();

    expect(resolutions).toEqual([
      ConflictResolution.AUTO_NUMBER,
      ConflictResolution.SKIP,
    ]);
    expect(closes).toHaveLength(1);

    element.remove();
  });

  it('closes when clicking the overlay', async () => {
    const element = document.createElement(
      'conflict-resolution-dialog'
    ) as ConflictResolutionDialogElement;
    element.open = true;
    element.conflictCount = 1;
    element.items = [];

    document.body.appendChild(element);
    await element.updateComplete;

    const closes: Event[] = [];
    element.addEventListener('dialog-close', (event) => closes.push(event));

    const overlay = element.shadowRoot?.querySelector<HTMLElement>('[data-role="dialog-overlay"]');
    overlay?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

    expect(closes).toHaveLength(1);

    element.remove();
  });
});
