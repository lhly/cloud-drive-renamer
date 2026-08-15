import type { FileItem, PlatformConfig, PlatformName, RenameResult } from '../../types/platform';
import { parseFileName } from '../../utils/helpers';
import { SharedCloudDriveAdapter, type PageScriptAPI } from '../shared/shared-cloud-drive-adapter';
import { getXunleiPageScriptInjector } from './page-script-injector';

interface XunleiFileItem {
  kind?: string;
  id?: string;
  parent_id?: string;
  name?: string;
  file_extension?: string;
  size?: string | number;
  modified_time?: string;
  user_modified_time?: string;
  created_time?: string;
}

interface XunleiFileListResponse {
  kind?: string;
  next_page_token?: string;
  files?: XunleiFileItem[];
  error?: string;
  error_code?: string | number;
  error_description?: string;
}

export class XunleiAdapter extends SharedCloudDriveAdapter {
  readonly platform: PlatformName = 'xunlei';

  constructor(config?: Partial<PlatformConfig>) {
    super({ platform: 'xunlei', requestInterval: 800, maxRetries: 3, timeout: 30000, ...config });
  }

  async getAllFiles(parentId?: string): Promise<FileItem[]> {
    const targetParentId = parentId ?? this.getCurrentFolderId();
    const files: FileItem[] = [];
    let pageToken = '';

    do {
      const url = new URL('https://api-pan.xunlei.com/drive/v1/files');
      url.searchParams.set('parent_id', targetParentId);
      url.searchParams.set('usage', 'DISPLAY');
      url.searchParams.set('filters', JSON.stringify({
        phase: { eq: 'PHASE_TYPE_COMPLETE' },
        trashed: { eq: false },
      }));
      url.searchParams.set('with_audit', 'true');
      url.searchParams.set('thumbnail_size', 'SIZE_SMALL');
      url.searchParams.set('limit', '50');
      if (pageToken) url.searchParams.set('page_token', pageToken);

      const response = await this.callAPI('GET', url.toString()) as XunleiFileListResponse;
      this.assertSuccessful(!response.error && !response.error_code, response.error_code, response.error_description || response.error || '迅雷云盘列表获取失败', response);
      if (!Array.isArray(response.files)) {
        throw new Error('迅雷云盘列表获取失败: missing file list');
      }

      files.push(...response.files.map((item) => this.toFileItem(item, targetParentId)));
      pageToken = response.next_page_token || '';
    } while (pageToken);

    return files;
  }

  async renameFile(fileId: string, newName: string): Promise<RenameResult> {
    return this.retryableRename(async () => {
      const response = await this.callAPI('PATCH', `https://api-pan.xunlei.com/drive/v1/files/${encodeURIComponent(fileId)}`, {
        name: newName,
      }) as XunleiFileListResponse;
      this.assertSuccessful(!response.error && !response.error_code, response.error_code, response.error_description || response.error || '迅雷云盘重命名失败', response);
    }, fileId, newName);
  }

  protected getCurrentFolderId(): string {
    const path = new URLSearchParams(window.location.search).get('path');
    if (!path) return '';

    try {
      const routes = JSON.parse(localStorage.getItem('xlPanHomeRoutes') || '{}') as Record<string, string>;
      const routeValue = routes[path] || routes[decodeURIComponent(path)];
      const routeIds = routeValue?.split('/').filter(Boolean) || [];
      return routeIds[routeIds.length - 1] || '';
    } catch {
      return '';
    }
  }

  protected getPageScriptAPI(): PageScriptAPI {
    return getXunleiPageScriptInjector();
  }

  private toFileItem(item: XunleiFileItem, parentId: string): FileItem {
    const name = item.name || '';
    const parsed = parseFileName(name);
    const ext = item.file_extension || parsed.ext;
    return {
      id: String(item.id || ''),
      name,
      ext,
      parentId: item.parent_id ?? parentId,
      size: Number(item.size ?? 0) || 0,
      mtime: this.normalizeTime(item.modified_time ?? item.user_modified_time ?? item.created_time),
    };
  }
}
