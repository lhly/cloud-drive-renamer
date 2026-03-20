import { describe, expect, it } from 'vitest';
import { VirtualPreviewList } from '../../src/content/components/virtual-preview-list';

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
});
