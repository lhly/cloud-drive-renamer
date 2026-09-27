import { BasePlatformAdapter } from '../base/adapter.interface';
import type { FileItem, PageSyncResult, RenameResult } from '../../types/platform';
import { OneDrivePageScriptInjector } from './page-script-injector';
import {
  makeOneDriveDirectoryKey,
  parseOneDriveChildrenPage,
  qualifyDriveIdentity,
  toOneDriveFileItem,
  validateOneDriveContinuation,
  type OneDriveDriveItem,
  type OneDriveFileItem,
} from './models';

interface OneDriveDirectoryResponse {
  item: OneDriveDriveItem;
  scopeKey: string;
  isRoot: boolean;
  pathLength: number;
}

interface CachedDirectory {
  routeKey: string;
  key: string;
  folderId: string;
  driveId: string;
  isRoot: boolean;
  parentId: string;
  pathLength: number;
}

interface BridgeError extends Error {
  status?: number;
  headers?: Record<string, string>;
}

export class OneDriveAdapter extends BasePlatformAdapter {
  readonly platform = 'onedrive' as const;
  private readonly bridge = new OneDrivePageScriptInjector();
  private directory: CachedDirectory | null = null;
  private filesById = new Map<string, OneDriveFileItem>();
  private rawItemsByParent = new Map<string, OneDriveDriveItem[]>();

  constructor() {
    super({ platform: 'onedrive', requestInterval: 250, maxConcurrent: 1, maxRetries: 3, timeout: 30000 });
  }

  async getSelectedFiles(): Promise<FileItem[]> {
    // OneDrive has virtualized native rows; the extension panel provides its own complete-list selection.
    return [];
  }

  async getAllFiles(parentId?: string): Promise<FileItem[]> {
    const directory = await this.getCurrentDirectory();
    const requestedParent = parentId?.split(':').slice(1).join(':');
    if (parentId && (requestedParent !== directory.folderId || (directory.driveId && parentId.split(':')[0] !== directory.driveId))) {
      throw new Error('OneDrive directory changed; reload the file list before continuing');
    }
    const rawItems: OneDriveDriveItem[] = [];
    const visited = new Set<string>();
    let continuation: string | undefined;
    let firstPage = true;
    do {
      const response = await this.readWithRetry(firstPage ? 'children' : 'children', {
        itemId: firstPage && !directory.isRoot ? directory.folderId : undefined,
        continuation,
      });
      const page = parseOneDriveChildrenPage(response.data);
      rawItems.push(...page.value);
      const next = page['@odata.nextLink'];
      if (next) {
        const safeNext = validateOneDriveContinuation(next, window.location.origin, '/personal/');
        if (visited.has(safeNext)) throw new Error('OneDrive returned a repeated continuation link');
        visited.add(safeNext);
        continuation = safeNext;
      } else continuation = undefined;
      firstPage = false;
    } while (continuation);

    this.rawItemsByParent.set(directory.parentId, rawItems);
    const files = rawItems.map(toOneDriveFileItem).filter((item): item is OneDriveFileItem => item !== null);
    this.filesById = new Map(files.map((file) => [file.id, file]));
    return files;
  }

  async renameFile(fileId: string, newName: string): Promise<RenameResult> {
    const file = this.filesById.get(fileId);
    if (!file) return { success: false, error: new Error('OneDrive file is stale; reload the directory and try again') };
    try {
      const directory = await this.getCurrentDirectory();
      validateOneDriveName(newName, directory.pathLength);
      const siblings = await this.readDirectoryItems(file.parentId);
      const target = this.normalizeConflictName(newName);
      const collision = siblings.some((item) => {
        if (item.name !== newName && this.normalizeConflictName(String(item.name ?? '')) === target) {
          const uniqueId = item.sharepointIds?.listItemUniqueId;
          return typeof uniqueId !== 'string' || uniqueId.toLowerCase() !== getIdentityGuid(fileId);
        }
        if (item.name === newName) {
          const uniqueId = item.sharepointIds?.listItemUniqueId;
          return typeof uniqueId !== 'string' || uniqueId.toLowerCase() !== getIdentityGuid(fileId);
        }
        return false;
      });
      if (collision) return { success: false, error: new Error('A file or folder with that name already exists in this OneDrive directory') };

      const response = await this.renameWithSafeRetry(file, newName);
      const result = response.data as { name?: unknown } | undefined;
      if (result?.name !== newName) throw new Error('OneDrive rename could not be verified');
      this.filesById.set(fileId, { ...file, name: newName, ext: this.getExtension(newName) });
      this.rawItemsByParent.clear();
      return { success: true, newName };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  getCurrentDirectoryKey(): string {
    if (this.directory?.routeKey === this.getRouteKey()) return this.directory.key;
    return `onedrive:unresolved:${this.getRouteKey()}`;
  }

  normalizeConflictName(fileName: string): string {
    return fileName.normalize('NFC').toLocaleLowerCase('en-US');
  }

  async checkNameConflict(fileName: string, parentId: string, excludeFileId?: string): Promise<boolean> {
    const siblings = await this.readDirectoryItems(parentId);
    const target = this.normalizeConflictName(fileName);
    return siblings.some((item) => {
      if (this.normalizeConflictName(String(item.name ?? '')) !== target) return false;
      const uniqueId = item.sharepointIds?.listItemUniqueId;
      const id = typeof uniqueId === 'string' ? uniqueId.toLowerCase() : '';
      return !excludeFileId || id !== getIdentityGuid(excludeFileId);
    });
  }

  async getFileInfo(fileId: string): Promise<FileItem> {
    const cached = this.filesById.get(fileId);
    if (!cached) throw new Error('OneDrive file details are unavailable; reload the directory');
    const response = await this.bridge.call('item', { itemId: cached.driveItemId.split(':').slice(1).join(':') });
    const fresh = toOneDriveFileItem(response.data as OneDriveDriveItem);
    if (!fresh || fresh.id !== fileId) throw new Error('OneDrive file identity changed; reload the directory');
    this.filesById.set(fileId, fresh);
    return fresh;
  }

  async syncAfterRename(): Promise<PageSyncResult> {
    return { success: false, method: 'manual-refresh' };
  }

  private async getCurrentDirectory(): Promise<CachedDirectory> {
    const routeKey = this.getRouteKey();
    if (this.directory?.routeKey === routeKey) return this.directory;
    const response = await this.readWithRetry('directory');
    const data = response.data as OneDriveDirectoryResponse;
    if (!data?.item || typeof data.item.id !== 'string' || typeof data.scopeKey !== 'string' || typeof data.pathLength !== 'number') {
      throw new Error('OneDrive returned an invalid current directory');
    }
    const parentRef = data.item.parentReference;
    const driveId = typeof parentRef?.driveId === 'string' ? parentRef.driveId : '';
    const folderId = data.item.id;
    const siteUrl = `${window.location.origin}${data.scopeKey.slice(0, data.scopeKey.lastIndexOf(':'))}`;
    const key = makeOneDriveDirectoryKey(siteUrl, driveId || 'personal-drive', folderId);
    const directory: CachedDirectory = {
      routeKey,
      key,
      folderId,
      driveId,
      isRoot: data.isRoot,
      parentId: qualifyDriveIdentity(driveId || 'personal-drive', folderId),
      pathLength: data.pathLength,
    };
    this.directory = directory;
    return directory;
  }

  private async readDirectoryItems(parentId: string): Promise<OneDriveDriveItem[]> {
    const directory = await this.getCurrentDirectory();
    const parentSuffix = parentId.split(':').slice(1).join(':');
    if (parentSuffix !== directory.folderId || (directory.driveId && parentId.split(':')[0] !== directory.driveId)) {
      throw new Error('OneDrive directory changed; reload the file list before checking names');
    }
    const cached = this.rawItemsByParent.get(directory.parentId);
    if (cached) return cached;
    await this.getAllFiles();
    return this.rawItemsByParent.get(directory.parentId) ?? [];
  }

  private async readWithRetry(
    operation: 'directory' | 'children' | 'item',
    options: { itemId?: string; continuation?: string } = {}
  ): Promise<{ data?: unknown; status?: number; headers?: Record<string, string> }> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.bridge.call(operation, options);
      } catch (error) {
        const failure = error as BridgeError;
        if ((failure.status !== 429 && failure.status !== 503) || attempt >= this.config.maxRetries) throw error;
        await this.sleep(getRetryAfterMs(failure.headers?.['retry-after'], attempt));
      }
    }
  }

  private async renameWithSafeRetry(file: OneDriveFileItem, newName: string): Promise<{ data?: unknown }> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.bridge.call('rename', {
          itemId: file.id,
          expectedOldName: file.name,
          expectedParentId: file.parentId,
          newName,
        });
      } catch (error) {
        const failure = error as BridgeError;
        const retryable = failure.status === 429 || failure.status === 503;
        if (!retryable && failure.status !== undefined) throw error;
        let current: OneDriveFileItem | null;
        try {
          const response = await this.bridge.call('item', { itemId: file.driveItemId.split(':').slice(1).join(':') });
          current = toOneDriveFileItem(response.data as OneDriveDriveItem);
        } catch {
          throw new Error('OneDrive rename result is uncertain; reload the directory and check the file before retrying');
        }
        if (!current || current.id !== file.id || current.parentId !== file.parentId) throw new Error('OneDrive rename result is uncertain; reload the directory before retrying');
        if (current.name === newName) return { data: { name: newName, id: file.id } };
        if (current.name !== file.name || !retryable || attempt >= this.config.maxRetries) throw error;
        await this.sleep(getRetryAfterMs(failure.headers?.['retry-after'], attempt));
      }
    }
  }

  private getRouteKey(): string {
    const url = new URL(window.location.href);
    url.hash = '';
    const directoryId = url.searchParams.get('id');
    url.search = directoryId === null ? '' : `?id=${encodeURIComponent(directoryId)}`;
    return url.href;
  }

  private getExtension(name: string): string {
    const dot = name.lastIndexOf('.');
    return dot <= 0 || dot === name.length - 1 ? '' : name.slice(dot);
  }
}

export function validateOneDriveName(name: string, parentPathLength = 0): void {
  const trimmed = name.trim();
  if (!name || !trimmed || name !== name.trim() || /[\\/:*?"<>|]/.test(name) || /[. ]$/.test(name)) {
    throw new Error('OneDrive file names cannot be blank, have leading or trailing spaces or periods, or contain \\ / : * ? " < > |');
  }
  const lowerName = name.toLowerCase();
  const stem = lowerName.split('.')[0];
  if (/^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/.test(stem) || lowerName === 'desktop.ini' || lowerName === '.lock' || lowerName.startsWith('~$') || lowerName.includes('_vti_')) {
    throw new Error('This name is reserved by OneDrive');
  }
  const nameLength = Array.from(name).length;
  if (nameLength > 255) throw new Error('OneDrive file name is too long');
  if (parentPathLength > 0 && parentPathLength + 1 + nameLength > 400) throw new Error('The complete OneDrive path is too long');
}

function getRetryAfterMs(value: string | undefined, attempt: number): number {
  if (value) {
    const seconds = Number(value);
    const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - Date.now();
    if (Number.isFinite(delay) && delay > 0) {
      if (delay > 2147483647) throw new Error('OneDrive requested a long retry delay; retry manually later');
      return delay;
    }
  }
  return Math.min(1000 * 2 ** attempt, 10000);
}

function getIdentityGuid(id: string): string {
  const parts = id.split(':');
  return (parts[parts.length - 1] ?? '').toLowerCase();
}
