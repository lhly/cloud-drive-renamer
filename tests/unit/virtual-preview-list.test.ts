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

  it('locks preview-item structure with semantic classes and target-specific truncation rules', async () => {
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


    const previewItem = element.shadowRoot?.querySelector('.preview-item');
    expect(previewItem).toBeTruthy();

    const previewContent = previewItem?.querySelector('.preview-content');
    expect(previewContent).toBeTruthy();

    const oldName = previewContent?.querySelector('.old-name.old-name-secondary');
    expect(oldName).toBeTruthy();

    const newNameText = previewContent?.querySelector('.new-name-text');
    expect(newNameText).toBeTruthy();

    const stylesArray = Array.isArray(VirtualPreviewList.styles)
      ? VirtualPreviewList.styles
      : [VirtualPreviewList.styles];
    const staticCss = stylesArray
      .map((result) => ('cssText' in result ? (result as any).cssText : result.toString()))
      .join(' ');
    const selectorBlock = (selector: string) => {
      const escaped = selector.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
      const regex = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 's');
      const match = regex.exec(staticCss);
      expect(match, `missing ${selector}`).toBeTruthy();
      return match![1];
    };

    const oldNameDeclarations = selectorBlock('.old-name.old-name-secondary');
    expect(oldNameDeclarations).toContain('overflow: hidden');
    expect(oldNameDeclarations).toContain('text-overflow: ellipsis');
    expect(oldNameDeclarations).toContain('white-space: nowrap');

    const baseOldNameDeclarations = selectorBlock('.old-name');
    expect(baseOldNameDeclarations).toContain('font-size: 12px');
    expect(baseOldNameDeclarations).toContain('color: var(--cdr-text-secondary, #595959)');
    expect(baseOldNameDeclarations).not.toContain('overflow: hidden');
    expect(baseOldNameDeclarations).not.toContain('text-overflow: ellipsis');
    expect(baseOldNameDeclarations).not.toContain('white-space: nowrap');

    const newNameDeclarations = selectorBlock('.new-name-primary .new-name-text');
    expect(newNameDeclarations).toContain('overflow: hidden');
    expect(newNameDeclarations).toContain('text-overflow: ellipsis');
    expect(newNameDeclarations).toContain('white-space: nowrap');

    const baseNewNameDeclarations = selectorBlock('.new-name-text');
    expect(baseNewNameDeclarations).not.toContain('overflow: hidden');
    expect(baseNewNameDeclarations).not.toContain('text-overflow: ellipsis');
    expect(baseNewNameDeclarations).not.toContain('white-space: nowrap');

    element.remove();
  });
});
