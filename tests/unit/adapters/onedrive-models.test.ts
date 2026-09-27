import { describe, expect, it } from 'vitest';
import {
  makeOneDriveDirectoryKey,
  parseOneDriveChildrenPage,
  toOneDriveFileItem,
  validateOneDriveContinuation,
} from '../../../src/adapters/onedrive/models';

const item = {
  id: 'hex!item-1',
  name: 'Episode 01.mkv',
  size: 128,
  eTag: '"version-1"',
  parentReference: { id: 'hex!folder', driveId: 'drive-1' },
  sharepointIds: {
    siteId: '11111111-1111-1111-1111-111111111111',
    listId: '22222222-2222-2222-2222-222222222222',
    listItemUniqueId: '33333333-3333-3333-3333-333333333333',
  },
  file: { mimeType: 'video/x-matroska' },
  lastModifiedDateTime: '2026-09-27T00:00:00Z',
};

describe('OneDrive data mapping', () => {
  it('keeps SharePoint GUID identity stable and qualifies the parent folder', () => {
    expect(toOneDriveFileItem(item)).toMatchObject({
      id: '11111111-1111-1111-1111-111111111111:22222222-2222-2222-2222-222222222222:33333333-3333-3333-3333-333333333333',
      parentId: 'drive-1:hex!folder',
      driveItemId: 'drive-1:hex!item-1',
      ext: '.mkv',
      size: 128,
      mtime: Date.parse('2026-09-27T00:00:00Z'),
    });
  });

  it('excludes folders, remote items, special folders, and incomplete identities', () => {
    expect(toOneDriveFileItem({ ...item, folder: { childCount: 1 } })).toBeNull();
    expect(toOneDriveFileItem({ ...item, remoteItem: { id: 'remote' } })).toBeNull();
    expect(toOneDriveFileItem({ ...item, specialFolder: { name: 'vault' } })).toBeNull();
    expect(toOneDriveFileItem({ ...item, sharepointIds: { ...item.sharepointIds, listItemUniqueId: 'bad' } })).toBeNull();
  });

  it('rejects malformed list payloads and unsafe continuation links', () => {
    expect(() => parseOneDriveChildrenPage({ value: 'not-an-array' })).toThrow(/invalid children response/i);
    expect(parseOneDriveChildrenPage({ value: [], '@odata.nextLink': '/personal/user/_api/v2.0/drive/root/children?$skiptoken=x' }).value).toEqual([]);
    expect(() => validateOneDriveContinuation('https://evil.example/_api/v2.0/drive/root/children', 'https://onedrive.live.com', '/personal/')).toThrow(/outside/i);
    expect(() => validateOneDriveContinuation('/photos', 'https://onedrive.live.com', '/personal/')).toThrow(/outside/i);
  });

  it('isolates directory keys by site path and folder', () => {
    expect(makeOneDriveDirectoryKey('https://onedrive.live.com/personal/a', 'drive', 'folder'))
      .not.toBe(makeOneDriveDirectoryKey('https://onedrive.live.com/personal/b', 'drive', 'folder'));
    expect(makeOneDriveDirectoryKey('https://onedrive.live.com/personal/a', 'drive', 'one'))
      .not.toBe(makeOneDriveDirectoryKey('https://onedrive.live.com/personal/a', 'drive', 'two'));
  });
});
