import { describe, expect, it } from 'vitest';
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
});
