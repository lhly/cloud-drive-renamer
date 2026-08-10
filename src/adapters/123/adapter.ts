import type { FileItem, PlatformConfig, PlatformName, RenameResult } from '../../types/platform';
import { parseFileName } from '../../utils/helpers';
import { SharedCloudDriveAdapter, type PageScriptAPI } from '../shared/shared-cloud-drive-adapter';
import { getDrive123PageScriptInjector } from './page-script-injector';

interface Drive123FileItem {
  FileId?: string | number;
  FileName?: string;
  ParentFileId?: string | number;
  Size?: string | number;
  UpdateAt?: string | number;
  Type?: number;
  type?: number;
}

interface Drive123ListResponse {
  data?: {
    InfoList?: Drive123FileItem[];
    Next?: string;
    Total?: number;
    Len?: number;
  };
  message?: string;
  code?: number;
}

interface Drive123RenameResponse {
  code?: number;
  message?: string;
}

export class Drive123Adapter extends SharedCloudDriveAdapter {
  readonly platform: PlatformName = '123';

  constructor(config?: Partial<PlatformConfig>) {
    super({ platform: '123', requestInterval: 200, maxRetries: 3, timeout: 30000, ...config });
  }

  async getAllFiles(parentId?: string): Promise<FileItem[]> {
    const targetParentId = parentId || this.getCurrentFolderId();
    const files: FileItem[] = [];
    let page = 1;
    let hasNext = true;

    while (hasNext) {
      const url = new URL('https://yun.123pan.cn/b/api/file/list/new?driveId=0&limit=100&next=0&orderBy=file_name&orderDirection=asc&trashed=false&SearchData=&OnlyLookAbnormalFile=0&event=homeListFile&operateType=4&inDirectSpace=false');
      url.searchParams.set('parentFileId', targetParentId);
      url.searchParams.set('Page', String(page++));

      const response = await this.callAPI('GET', url.toString()) as Drive123ListResponse;
      this.assertSuccessful(response.code === undefined || response.code === 0, response.code, response.message || '123 list failed', response);

      const list = response.data?.InfoList;
      if (!Array.isArray(list)) {
        throw new Error('123 list failed: missing file list');
      }

      files.push(...list.filter((item) => (item.Type ?? item.type) !== 1).map((item) => this.toFileItem(item, targetParentId)));
      hasNext = response.data?.Next !== '-1' && response.data?.Total !== 0 && response.data?.Len !== 0 && list.length > 0;
    }

    return files;
  }

  async renameFile(fileId: string, newName: string): Promise<RenameResult> {
    return this.retryableRename(async () => {
      const response = await this.callAPI('POST', 'https://yun.123pan.cn/b/api/file/rename', {
        driveId: 0,
        fileId,
        fileName: newName,
        duplicate: 1,
        event: 'fileRename',
        operatePlace: 2,
        RequestSource: null,
      }) as Drive123RenameResponse;
      this.assertSuccessful(response.code === undefined || response.code === 0, response.code, response.message || '123 rename failed', response);
    }, fileId, newName);
  }

  protected getCurrentFolderId(): string {
    const params = new URLSearchParams(window.location.search);
    const path = params.get('homeFilePath') || '0';
    const groups = path.split(',').filter(Boolean);
    return groups[groups.length - 1] || '0';
  }

  protected getPageScriptAPI(): PageScriptAPI {
    return getDrive123PageScriptInjector();
  }

  private toFileItem(item: Drive123FileItem, parentId: string): FileItem {
    const name = item.FileName || '';
    const { ext } = parseFileName(name);
    return {
      id: String(item.FileId),
      name,
      ext,
      parentId: String(item.ParentFileId || parentId),
      size: Number(item.Size ?? 0) || 0,
      mtime: this.normalizeTime(item.UpdateAt),
    };
  }
}
