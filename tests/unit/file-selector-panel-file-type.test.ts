import { describe, expect, it } from 'vitest';
import { FileSelectorPanel } from '../../src/content/components/file-selector-panel';
import type { FileType } from '../../src/types/file-selector';

type FileSelectorPanelTypeHarness = FileSelectorPanel & {
  getFileType(ext: string): FileType;
};

describe('FileSelectorPanel file type classification', () => {
  it('classifies .sup subtitle files with the video filter', () => {
    const panel = new FileSelectorPanel() as unknown as FileSelectorPanelTypeHarness;

    expect(panel.getFileType('.sup')).toBe('video');
    expect(panel.getFileType('.SUP')).toBe('video');
  });
});
