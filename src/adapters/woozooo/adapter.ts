import type { FileItem, PlatformConfig, PlatformName, RenameResult } from '../../types/platform';
import { parseFileName } from '../../utils/helpers';
import { SharedCloudDriveAdapter, type PageScriptAPI } from '../shared/shared-cloud-drive-adapter';
import { getWoozoooPageScriptInjector } from './page-script-injector';

interface WoozoooFileItem {
  id?: string | number;
  name?: string;
  name_all?: string;
  size?: string | number;
  time?: string;
}

interface WoozoooListResponse {
  zt?: string | number;
  info?: string | number | unknown[];
  text?: WoozoooFileItem[];
  dat?: unknown;
}

interface WoozoooRenameResponse {
  zt?: string | number;
  info?: string;
  text?: unknown;
  dat?: unknown;
}

export class WoozoooAdapter extends SharedCloudDriveAdapter {
  readonly platform: PlatformName = 'woozooo';

  constructor(config?: Partial<PlatformConfig>) {
    super({ platform: 'woozooo', requestInterval: 800, maxRetries: 3, timeout: 30000, ...config });
  }

  async getAllFiles(parentId?: string): Promise<FileItem[]> {
    const folderId = parentId ?? this.getCurrentFolderId();
    const uid = this.getUid();
    const vei = this.getVei();
    const files: FileItem[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.callAPI('POST', `https://pc.woozooo.com/doupload.php?uid=${encodeURIComponent(uid)}`, {
        bodyMode: 'urlencoded',
        entries: [
          ['task', '5'],
          ['folder_id', folderId],
          ['pg', String(page)],
          ['vei', vei],
        ],
      }) as WoozoooListResponse;

      this.assertSuccessful(this.isSuccessful(response), response.zt, this.getErrorMessage(response, '蓝奏云列表获取失败'), response);
      if (!Array.isArray(response.text)) {
        throw new Error('蓝奏云列表获取失败: missing file list');
      }

      files.push(...response.text.map((item) => this.toFileItem(item, folderId)));
      hasMore = String(response.info) !== '0' && response.text.length > 0;
      page += 1;
    }

    return files;
  }

  async renameFile(fileId: string, newName: string): Promise<RenameResult> {
    return this.retryableRename(async () => {
      const response = await this.callAPI('POST', 'https://pc.woozooo.com/doupload.php', {
        bodyMode: 'urlencoded',
        entries: [
          ['task', '46'],
          ['file_id', fileId],
          ['file_name', parseFileName(newName).name],
          ['type', '2'],
        ],
      }) as WoozoooRenameResponse;
      this.assertSuccessful(this.isSuccessful(response), response.zt, this.getErrorMessage(response, '蓝奏云重命名失败'), response);
    }, fileId, newName);
  }

  protected getCurrentFolderId(): string {
    const doc = this.getFileFrameDocument();
    return doc?.querySelector<HTMLInputElement>('#folder_id_bibao')?.value || '-1';
  }

  protected getPageScriptAPI(): PageScriptAPI {
    return getWoozoooPageScriptInjector();
  }

  private toFileItem(item: WoozoooFileItem, parentId: string): FileItem {
    const name = item.name_all || item.name || '';
    const { ext } = parseFileName(name);
    return {
      id: String(item.id || ''),
      name,
      ext,
      parentId,
      size: Number(item.size ?? 0) || 0,
      mtime: this.normalizeTime(item.time),
    };
  }

  private getFileFrameDocument(): Document | null {
    const frame = document.querySelector<HTMLIFrameElement>('#mainframe');
    try {
      return frame?.contentDocument || document;
    } catch {
      return document;
    }
  }

  private getUid(): string {
    const frame = document.querySelector<HTMLIFrameElement>('#mainframe');
    const doc = this.getFileFrameDocument();
    const candidates = [frame?.src, doc?.location?.href, window.location.href];

    for (const href of candidates) {
      if (!href) continue;
      try {
        const uid = new URL(href).searchParams.get('u');
        if (uid) return uid;
      } catch {
        // Ignore malformed or about:blank URLs and try the next source.
      }
    }
    return '';
  }

  private getVei(): string {
    const win = this.getFileFrameWindow();
    const sources = [win && typeof win.more === 'function' ? String(win.more) : '', win && typeof win.folder === 'function' ? String(win.folder) : ''];
    for (const source of sources) {
      const match = source.match(/['"]vei['"]\s*:\s*['"]([^'"]+)['"]/);
      if (match?.[1]) return match[1];
    }
    return '';
  }

  private getFileFrameWindow(): (Window & typeof globalThis & { more?: unknown; folder?: unknown }) | null {
    const frame = document.querySelector<HTMLIFrameElement>('#mainframe');
    try {
      return (frame?.contentWindow as Window & typeof globalThis & { more?: unknown; folder?: unknown }) || window;
    } catch {
      return window;
    }
  }

  private isSuccessful(response: { zt?: string | number }): boolean {
    return String(response.zt) === '1';
  }

  private getErrorMessage(response: { info?: unknown }, fallback: string): string {
    return typeof response.info === 'string' && response.info ? response.info : fallback;
  }
}
