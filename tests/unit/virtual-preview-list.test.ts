import { describe, expect, it, vi } from 'vitest';
import { VirtualPreviewList } from '../../src/content/components/virtual-preview-list';
import { I18nService } from '../../src/utils/i18n';

describe('VirtualPreviewList pending preview mapping', () => {
  it('renders original name and new name for a pending preview item', async () => {
    const element = new VirtualPreviewList();
    element.items = [
      {
        file: {
          id: 'file-1',
          name: 'old-episode.mkv',
          ext: 'mkv',
          size: 42,
          mtime: Date.now(),
          isDir: false,
        },
        newName: 'new-episode.mkv',
        conflict: false,
        done: false,
      },
    ];

    document.body.appendChild(element);
    await element.updateComplete;

    const textContent = element.shadowRoot?.textContent ?? '';
    expect(textContent).toContain('old-episode.mkv');
    expect(textContent).toContain('new-episode.mkv');

    element.remove();
  });

  it('renders conflict items with status badge and helper text', async () => {
    const element = new VirtualPreviewList();
    element.items = [
      {
        file: {
          id: 'file-conflict',
          name: 'old-conflict.mkv',
          ext: 'mkv',
          size: 1,
          mtime: Date.now(),
          isDir: false,
        },
        newName: 'new-conflict.mkv',
        conflict: true,
        done: false,
      },
    ];

    document.body.appendChild(element);
    await element.updateComplete;

    const textContent = element.shadowRoot?.textContent ?? '';
    expect(textContent).toContain('old-conflict.mkv');
    expect(textContent).toContain('new-conflict.mkv');
    expect(textContent).toContain(I18nService.t('preview_badge_conflict'));
    expect(textContent).toContain(I18nService.t('error_api_conflict'));

    const badge = element.shadowRoot?.querySelector('.old-name-row .status-badge.conflict');
    expect(badge).toBeTruthy();

    element.remove();
  });

  it('shows localized extract_episode_not_found message instead of raw error key', async () => {
    const element = new VirtualPreviewList();
    element.items = [
      {
        file: {
          id: 'file-error',
          name: 'old-error.mkv',
          ext: 'mkv',
          size: 1,
          mtime: Date.now(),
          isDir: false,
        },
        newName: 'new-error.mkv',
        conflict: false,
        error: 'extract_episode_not_found',
      },
    ];

    document.body.appendChild(element);
    await element.updateComplete;

    const textContent = element.shadowRoot?.textContent ?? '';
    expect(textContent).toContain(I18nService.t('error_extract_episode_not_found'));

    element.remove();
  });

  it('keeps pending badge next to old name row when showStatus is true', async () => {
    const element = new VirtualPreviewList();
    element.showStatus = true;
    element.items = [
      {
        file: {
          id: 'file-pending',
          name: 'old-pending.mkv',
          ext: 'mkv',
          size: 1,
          mtime: Date.now(),
          isDir: false,
        },
        newName: 'new-pending.mkv',
        conflict: false,
        done: false,
      },
    ];

    document.body.appendChild(element);
    await element.updateComplete;

    const badge = element.shadowRoot?.querySelector('.old-name-row .status-badge.pending');
    expect(badge).toBeTruthy();

    element.remove();
  });

  it('renders raw error text without warning when given a network error message', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const element = new VirtualPreviewList();
    element.items = [
      {
        file: {
          id: 'file-network',
          name: 'old-network.mkv',
          ext: 'mkv',
          size: 1,
          mtime: Date.now(),
          isDir: false,
        },
        newName: 'new-network.mkv',
        conflict: false,
        error: 'Network error',
      },
    ];

    document.body.appendChild(element);
    await element.updateComplete;

    const textContent = element.shadowRoot?.textContent ?? '';
    expect(textContent).toContain('Network error');
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
    element.remove();
  });

  it('locks preview-item/preview-content structure with secondary/primary name classes and truncation styles', async () => {
    const element = new VirtualPreviewList();
    element.items = [
      {
        file: {
          id: 'file-structure',
          name: 'old-very-long-name-that-should-truncate.mkv',
          ext: 'mkv',
          size: 1,
          mtime: Date.now(),
          isDir: false,
        },
        newName: 'new-very-long-name-that-should-also-truncate.mkv',
        conflict: false,
      },
    ];

    document.body.appendChild(element);
    await element.updateComplete;

    const previewItem = element.shadowRoot?.querySelector('.preview-item[data-preview-item="true"]');
    expect(previewItem).toBeTruthy();

    const previewContent = previewItem?.querySelector('.preview-content[data-preview-content="true"]');
    expect(previewContent).toBeTruthy();

    const oldName = previewContent?.querySelector('.old-name.old-name-secondary');
    expect(oldName).toBeTruthy();

    const newName = previewContent?.querySelector('.new-name.new-name-primary');
    expect(newName).toBeTruthy();
    const newNameText = newName?.querySelector('.new-name-text');
    expect(newNameText).toBeTruthy();
    const styleContent = Array.from(element.shadowRoot?.querySelectorAll('style') ?? [])
      .map((style) => style.textContent ?? '')
      .join(' ');
    expect(styleContent).toContain('overflow: hidden');
    expect(styleContent).toContain('text-overflow: ellipsis');
    expect(styleContent).toContain('white-space: nowrap');

    element.remove();
  });
});
