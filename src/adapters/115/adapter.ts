import type { FileItem, PlatformConfig, PlatformName, RenameResult } from '../../types/platform';
import { parseFileName } from '../../utils/helpers';
import { SharedCloudDriveAdapter, type PageScriptAPI } from '../shared/shared-cloud-drive-adapter';
import { getDrive115PageScriptInjector } from './page-script-injector';

interface Drive115ListItem {
  fid?: string | number;
  cid?: string | number;
  n?: string;
  size?: string | number;
  s?: string | number;
  upt?: string | number;
  te?: string | number;
}

interface Drive115ListResponse {
  state?: boolean;
  count?: string | number;
  data?: Drive115ListItem[];
  error?: string;
}

interface Drive115RenameResponse {
  state?: boolean;
  error?: string;
}

export class Drive115Adapter extends SharedCloudDriveAdapter {
  readonly platform: PlatformName = '115';

  constructor(config?: Partial<PlatformConfig>) {
    super({ platform: '115', requestInterval: 800, maxRetries: 3, timeout: 30000, ...config });
  }

  async getAllFiles(parentId?: string): Promise<FileItem[]> {
    const targetParentId = parentId || this.getCurrentFolderId();
    const files: FileItem[] = [];
    const pageSize = 200;
    let offset = 0;
    let total = Number.POSITIVE_INFINITY;

    while (files.length < total) {
      const url = new URL('https://webapi.115.com/files');
      url.searchParams.set('aid', '1');
      url.searchParams.set('cid', targetParentId);
      url.searchParams.set('offset', String(offset));
      url.searchParams.set('limit', String(pageSize));
      url.searchParams.set('type', '0');
      url.searchParams.set('show_dir', '1');
      url.searchParams.set('fc_mix', '0');
      url.searchParams.set('natsort', '1');
      url.searchParams.set('count_folders', '1');
      url.searchParams.set('format', 'json');
      url.searchParams.set('custom_order', '0');

      const response = await this.callAPI('GET', url.toString()) as Drive115ListResponse;
      this.assertSuccessful(response.state !== false && Array.isArray(response.data), undefined, response.error || '115 list failed', response);
      const list = response.data || [];
      files.push(...list.filter((item) => item.fid !== undefined && item.fid !== null).map((item) => this.toFileItem(item, targetParentId)));

      const parsedTotal = Number(response.count);
      total = Number.isFinite(parsedTotal) ? parsedTotal : files.length;
      offset += list.length;
      if (list.length < pageSize) break;
    }

    return files;
  }

  async renameFile(fileId: string, newName: string): Promise<RenameResult> {
    return this.retryableRename(async () => {
      const response = await this.callAPI('POST', 'https://webapi.115.com/files/batch_rename', {
        bodyMode: 'form-data',
        entries: [
          [`files_new_name[${fileId}]`, newName],
          ['format', 'json'],
        ],
      }) as Drive115RenameResponse;
      this.assertSuccessful(response.state === true, undefined, response.error || '115 rename failed', response);
    }, fileId, newName);
  }

  protected getCurrentFolderId(): string {
    return new URLSearchParams(window.location.search).get('cid') || '0';
  }

  protected getPageScriptAPI(): PageScriptAPI {
    return getDrive115PageScriptInjector();
  }

  private toFileItem(item: Drive115ListItem, parentId: string): FileItem {
    const name = item.n || '';
    const { ext } = parseFileName(name);
    return {
      id: String(item.fid),
      name,
      ext,
      parentId: String(item.cid || parentId),
      size: Number(item.size ?? item.s ?? 0) || 0,
      mtime: this.normalizeTime(item.upt ?? item.te),
    };
  }
}
