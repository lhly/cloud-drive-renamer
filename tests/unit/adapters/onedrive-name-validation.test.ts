import { describe, expect, it } from 'vitest';
import { validateOneDriveName } from '../../../src/adapters/onedrive/adapter';

describe('OneDrive name validation', () => {
  it('accepts ordinary Unicode names and measures characters rather than UTF-8 bytes', () => {
    expect(() => validateOneDriveName(`${'中'.repeat(250)}.txt`, 20)).not.toThrow();
  });

  it('rejects OneDrive-invalid whitespace, characters, reserved names and excessive paths', () => {
    expect(() => validateOneDriveName('file.lock')).not.toThrow();
    for (const name of ['', '  ', ' leading.txt', 'trailing .txt ', 'name.', 'bad/name', 'CON.txt', 'desktop.ini', '.lock', '~$draft.docx', 'x_vti_y.txt']) {
      expect(() => validateOneDriveName(name)).toThrow();
    }
    expect(() => validateOneDriveName('a'.repeat(256))).toThrow(/long/i);
    expect(() => validateOneDriveName('中文.txt', 398)).toThrow(/path/i);
  });
});
