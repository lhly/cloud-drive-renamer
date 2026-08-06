import type { FileItem, PlatformConfig, PlatformName, RenameResult } from '../../types/platform';
import { parseFileName } from '../../utils/helpers';
import { SharedCloudDriveAdapter, type PageScriptAPI } from '../shared/shared-cloud-drive-adapter';
import { getEsurfingPageScriptInjector } from './page-script-injector';

interface EsurfingFileItem {
  id?: string | number;
  name?: string;
  size?: string | number;
  lastOpTime?: string | number;
  lastOpTimeStr?: string;
  createDate?: string | number;
}

interface EsurfingListResponse {
  fileListAO?: {
    fileList?: EsurfingFileItem[];
  };
  res_code?: string | number;
  res_message?: string;
}

interface EsurfingRenameResponse {
  res_code?: string | number;
  res_message?: string;
}

export class EsurfingAdapter extends SharedCloudDriveAdapter {
  readonly platform: PlatformName = 'esurfing';

  constructor(config?: Partial<PlatformConfig>) {
    super({ platform: 'esurfing', requestInterval: 800, maxRetries: 3, timeout: 30000, ...config });
  }

  async getAllFiles(parentId?: string): Promise<FileItem[]> {
    const targetParentId = parentId || this.getCurrentFolderId();
    const files: FileItem[] = [];
    const pageSize = 60;
    let page = 1;
    let hasNext = true;

    while (hasNext) {
      const url = new URL('https://cloud.189.cn/api/open/file/listFiles.action?pageSize=60&mediaType=0&iconOption=5&orderBy=filename&descending=false');
      url.searchParams.set('folderId', targetParentId);
      url.searchParams.set('pageNum', String(page++));

      const response = await this.callAPI('GET', url.toString(), {
        bodyMode: 'headers',
        headers: {
          Accept: 'application/json;charset=UTF-8',
          'sign-type': '1',
        },
      }) as EsurfingListResponse;
      this.assertSuccessful(String(response.res_code ?? '0') === '0' || String(response.res_code ?? '0') === '200', response.res_code, response.res_message || '天翼云盘列表获取失败', response);

      const list = response.fileListAO?.fileList;
      if (!Array.isArray(list)) {
        throw new Error('天翼云盘列表获取失败: missing file list');
      }

      files.push(...list.map((item) => this.toFileItem(item, targetParentId)));
      hasNext = list.length === pageSize;
    }

    return files;
  }

  async renameFile(fileId: string, newName: string): Promise<RenameResult> {
    return this.retryableRename(async () => {
      const response = await this.callAPI('POST', 'https://cloud.189.cn/api/open/file/renameFile.action', {
        bodyMode: 'urlencoded',
        entries: [
          ['fileId', fileId],
          ['destFileName', newName],
        ],
        headers: {
          Accept: 'application/json;charset=UTF-8',
        },
      }) as EsurfingRenameResponse;
      const code = String(response.res_code ?? '0');
      this.assertSuccessful(code === '0' || code === '200' || code === 'SUCCESS', response.res_code, response.res_message || '天翼云盘重命名失败', response);
    }, fileId, newName);
  }

  protected getCurrentFolderId(): string {
    const match = window.location.pathname.match(/\/web\/main\/file\/folder\/([^/]+)/);
    return match?.[1] || '0';
  }

  protected getPageScriptAPI(): PageScriptAPI {
    return getEsurfingPageScriptInjector();
  }

  private toFileItem(item: EsurfingFileItem, parentId: string): FileItem {
    const name = item.name || '';
    const { ext } = parseFileName(name);
    return {
      id: String(item.id),
      name,
      ext,
      parentId,
      size: Number(item.size ?? 0) || 0,
      mtime: this.normalizeTime(item.lastOpTime ?? item.lastOpTimeStr ?? item.createDate),
    };
  }
}
