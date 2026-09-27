import type { FileItem } from '../../types/platform';

/** Minimal DriveItem shape returned by OneDrive's same-origin v2.0 endpoint. */
export interface OneDriveDriveItem {
  id?: unknown;
  name?: unknown;
  size?: unknown;
  eTag?: unknown;
  parentReference?: {
    id?: unknown;
    driveId?: unknown;
  };
  sharepointIds?: {
    listId?: unknown;
    listItemUniqueId?: unknown;
    siteId?: unknown;
  };
  file?: unknown;
  folder?: unknown;
  remoteItem?: unknown;
  specialFolder?: unknown;
  lastModifiedDateTime?: unknown;
  fileSystemInfo?: {
    lastModifiedDateTime?: unknown;
  };
}

export interface OneDriveChildrenPage {
  value: OneDriveDriveItem[];
  '@odata.nextLink'?: string;
}

export interface OneDriveFileItem extends FileItem {
  /** Site/list-qualified SharePoint item GUID, stable across a rename. */
  id: string;
  /** Drive-qualified parent identity, used to isolate directory operations. */
  parentId: string;
  /** Server-provided entity tag used for conditional updates. */
  eTag: string;
  /** Drive-qualified v2 item ID used for fresh API reads. */
  driveItemId: string;
}

export function qualifyDriveIdentity(driveId: string, itemId: string): string {
  return `${driveId}:${itemId}`;
}

export function parseOneDriveChildrenPage(payload: unknown): OneDriveChildrenPage {
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { value?: unknown }).value)) {
    throw new Error('OneDrive returned an invalid children response');
  }

  const data = payload as { value: OneDriveDriveItem[]; '@odata.nextLink'?: unknown };
  const nextLink = data['@odata.nextLink'];
  if (nextLink !== undefined && typeof nextLink !== 'string') {
    throw new Error('OneDrive returned an invalid continuation link');
  }

  return { value: data.value, '@odata.nextLink': nextLink as string | undefined };
}

/** Validate continuation links before the page-world bridge is asked to fetch them. */
export function validateOneDriveContinuation(
  link: string,
  siteOrigin: string,
  apiPathPrefix = '/_api/v2.0/'
): string {
  let url: URL;
  try {
    url = new URL(link, siteOrigin);
  } catch {
    throw new Error('OneDrive returned an invalid continuation URL');
  }

  const origin = new URL(siteOrigin).origin;
  if (url.origin !== origin || !url.pathname.startsWith(apiPathPrefix)) {
    throw new Error('OneDrive continuation URL is outside the current site API');
  }
  return url.href;
}

export function toOneDriveFileItem(item: OneDriveDriveItem): OneDriveFileItem | null {
  const sp = item.sharepointIds;
  if (item.remoteItem !== undefined || item.specialFolder !== undefined || item.folder !== undefined || !item.file ||
      typeof item.id !== 'string' || !item.id || typeof item.name !== 'string' ||
      typeof item.eTag !== 'string' || !item.eTag ||
      typeof item.parentReference?.driveId !== 'string' || !item.parentReference.driveId ||
      typeof item.parentReference.id !== 'string' || !item.parentReference.id ||
      typeof sp?.siteId !== 'string' || typeof sp.listId !== 'string' ||
      typeof sp.listItemUniqueId !== 'string' || !isGuid(sp.listItemUniqueId)) {
    return null;
  }

  const size = typeof item.size === 'number' && Number.isFinite(item.size) ? item.size : 0;
  const modified = item.lastModifiedDateTime ?? item.fileSystemInfo?.lastModifiedDateTime;
  const parsedMtime = typeof modified === 'string' ? Date.parse(modified) : NaN;

  return {
    id: `${sp.siteId}:${sp.listId}:${sp.listItemUniqueId.toLowerCase()}`,
    name: item.name,
    ext: getFileExtension(item.name),
    parentId: qualifyDriveIdentity(item.parentReference.driveId, item.parentReference.id),
    size,
    mtime: Number.isFinite(parsedMtime) ? parsedMtime : 0,
    eTag: item.eTag,
    driveItemId: qualifyDriveIdentity(item.parentReference.driveId, item.id),
  };
}

function isGuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function getFileExtension(name: string): string {
  const dotIndex = name.lastIndexOf('.');
  return dotIndex <= 0 || dotIndex === name.length - 1 ? '' : name.slice(dotIndex);
}

export function makeOneDriveDirectoryKey(siteUrl: string, driveId: string, folderId: string): string {
  const site = new URL(siteUrl);
  return `onedrive:${site.host}${site.pathname.replace(/\/$/, '')}:${driveId}:${folderId}`;
}
