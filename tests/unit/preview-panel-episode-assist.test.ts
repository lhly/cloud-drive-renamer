import { describe, expect, it } from 'vitest';
import { PreviewPanel } from '../../src/content/components/preview-panel';
import { VirtualPreviewList } from '../../src/content/components/virtual-preview-list';

describe('PreviewPanel episode assist bridge', () => {
  it('renders assist controls and bubbles preview assist events', async () => {
    const panel = new PreviewPanel();
    panel.episodeExtractAssistEnabled = true;
    panel.episodeExtractAssistState = {
      sampleFileId: 'file-1',
      sampleFileName: 'My.Show.S01E01',
      fillTarget: 'prefix',
      fillMode: 'segment',
      suggestedFailureFileId: 'file-1',
    };
    panel.items = [
      {
        file: {
          id: 'file-1',
          name: 'My.Show.S01E01.mkv',
          ext: '.mkv',
          parentId: 'root',
          size: 1,
          mtime: Date.now(),
        },
        newName: 'My.Show.S01E01.mkv',
        conflict: false,
        error: 'extract_episode_not_found',
      },
    ];

    const fullNameEvents: Array<CustomEvent<{ fileName: string }>> = [];
    const segmentEvents: Array<CustomEvent<{ segment: string }>> = [];
    const sampleEvents: Event[] = [];
    const prefixEvents: Event[] = [];
    const modeEvents: Event[] = [];
    panel.addEventListener('episode-assist-apply-full-name', (event) => fullNameEvents.push(event as CustomEvent<{ fileName: string }>));
    panel.addEventListener('episode-assist-apply-segment', (event) => segmentEvents.push(event as CustomEvent<{ segment: string }>));
    panel.addEventListener('episode-assist-use-item-as-sample', (event) => sampleEvents.push(event));
    panel.addEventListener('episode-assist-use-prefix-from-item', (event) => prefixEvents.push(event));
    panel.addEventListener('episode-assist-focus-segment-mode', (event) => modeEvents.push(event));

    document.body.appendChild(panel);
    await panel.updateComplete;

    const previewList = panel.shadowRoot?.querySelector('virtual-preview-list') as VirtualPreviewList | null;
    expect(previewList).toBeTruthy();
    await previewList?.updateComplete;

    previewList?.shadowRoot
      ?.querySelector<HTMLElement>('[data-role="episode-assist-apply-full-name"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    previewList?.shadowRoot
      ?.querySelector<HTMLElement>('[data-role="episode-assist-segment"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    previewList?.shadowRoot
      ?.querySelector<HTMLElement>('[data-role="episode-assist-use-item-as-sample"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    previewList?.shadowRoot
      ?.querySelector<HTMLElement>('[data-role="episode-assist-use-prefix-from-item"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    previewList?.shadowRoot
      ?.querySelector<HTMLElement>('[data-role="episode-assist-focus-segment-mode"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

    expect(fullNameEvents).toHaveLength(1);
    expect(fullNameEvents[0].detail.fileName).toBe('My.Show.S01E01');
    expect(segmentEvents).toHaveLength(1);
    expect(segmentEvents[0].detail.segment).toBe('My');
    expect(sampleEvents).toHaveLength(1);
    expect(prefixEvents).toHaveLength(1);
    expect(modeEvents).toHaveLength(1);

    const focusedItem = previewList?.shadowRoot?.querySelector('[data-file-id="file-1"]');
    const focusHint = previewList?.shadowRoot?.querySelector('[data-role="episode-assist-focus-hint"]');
    expect(focusedItem?.className).toContain('assist-focus');
    expect(focusHint?.textContent).toContain('定位');

    panel.remove();
  });

  it('renders failure navigation in preview header and dispatches focus events', async () => {
    const panel = new PreviewPanel();
    panel.episodeExtractAssistEnabled = true;
    panel.episodeExtractAssistState = {
      sampleFileId: 'file-2',
      sampleFileName: 'My.Show.S01E02',
      fillTarget: 'prefix',
      fillMode: 'segment',
      suggestedFailureFileId: 'file-2',
    };
    panel.items = [
      {
        file: {
          id: 'file-1',
          name: 'My.Show.S01E01.mkv',
          ext: '.mkv',
          parentId: 'root',
          size: 1,
          mtime: Date.now(),
        },
        newName: 'My.Show.S01E01.mkv',
        conflict: false,
        error: 'extract_episode_not_found',
      },
      {
        file: {
          id: 'file-2',
          name: 'My.Show.S01E02.mkv',
          ext: '.mkv',
          parentId: 'root',
          size: 1,
          mtime: Date.now(),
        },
        newName: 'My.Show.S01E02.mkv',
        conflict: false,
        error: 'extract_episode_not_found',
      },
      {
        file: {
          id: 'file-3',
          name: 'My.Show.S01E03.mkv',
          ext: '.mkv',
          parentId: 'root',
          size: 1,
          mtime: Date.now(),
        },
        newName: 'My.Show.S01E03.mkv',
        conflict: false,
        error: 'extract_episode_not_found',
      },
    ];

    const focusEvents: Array<CustomEvent<{ fileId: string }>> = [];
    panel.addEventListener('episode-assist-focus-failure', (event) => {
      focusEvents.push(event as CustomEvent<{ fileId: string }>);
    });

    document.body.appendChild(panel);
    await panel.updateComplete;

    const summary = panel.shadowRoot?.querySelector('[data-role="episode-assist-failure-nav-summary"]');
    const prevButton = panel.shadowRoot?.querySelector<HTMLButtonElement>('[data-role="episode-assist-prev-failure"]');
    const nextButton = panel.shadowRoot?.querySelector<HTMLButtonElement>('[data-role="episode-assist-next-failure"]');

    const label = panel.shadowRoot?.querySelector('[data-role="episode-assist-failure-nav-summary"] .failure-nav-label');
    expect(label?.textContent).not.toContain('3');
    expect(summary?.textContent).toContain('2 / 3');
    expect(panel.shadowRoot?.querySelector('[data-role="episode-assist-failure-nav-summary"] .failure-nav-count')).toBeNull();
    expect(panel.shadowRoot?.querySelector('[data-role="episode-assist-failure-nav-summary"] .failure-nav-position')).toBeTruthy();
    expect(prevButton?.disabled).toBe(false);
    expect(nextButton?.disabled).toBe(false);

    prevButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    nextButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

    expect(focusEvents).toHaveLength(2);
    expect(focusEvents[0].detail.fileId).toBe('file-1');
    expect(focusEvents[1].detail.fileId).toBe('file-3');

    panel.remove();
  });

});
