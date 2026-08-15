import type { FileItem, PlatformConfig, PlatformName, RenameResult } from '../../types/platform';
import { parseFileName } from '../../utils/helpers';
import { SharedCloudDriveAdapter, type PageScriptAPI } from '../shared/shared-cloud-drive-adapter';
import { getGuangyaPanPageScriptInjector } from './page-script-injector';
import { RUNTIME_MESSAGE_TYPES } from '../../types/runtime-message';

interface GuangyaPanFileItem {
  fileId?: string;
  fileName?: string;
  fileSize?: number;
  dirType?: number;
  mineType?: string;
  ext?: string;
  ctime?: string;
  utime?: string;
}

interface GuangyaPanListResponse {
  msg?: string;
  data?: {
    total?: number;
    list?: GuangyaPanFileItem[];
  };
}

export class GuangyaPanAdapter extends SharedCloudDriveAdapter {
  readonly platform: PlatformName = 'guangyapan';

  constructor(config?: Partial<PlatformConfig>) {
    super({ platform: 'guangyapan', requestInterval: 800, maxRetries: 3, timeout: 30000, ...config });
  }

  async getAllFiles(parentId?: string): Promise<FileItem[]> {
    const targetParentId = parentId ?? this.getCurrentFolderId();
    const files: FileItem[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await this.callAPI('POST', 'https://api.guangyapan.com/userres/v1/file/get_file_list', {
        pageSize: 50,
        orderBy: 3,
        sortType: 1,
        parentId: targetParentId,
        page,
      }) as GuangyaPanListResponse;

      this.assertSuccessful(response.msg === 'success', response.msg, '光鸭云盘列表获取失败', response);

      const list = response.data?.list;
      if (!Array.isArray(list)) {
        throw new Error('光鸭云盘列表获取失败: missing file list');
      }

      for (const item of list) {
        files.push(this.toFileItem(item, targetParentId));
      }

      hasMore = files.length < (response.data?.total ?? 0) && list.length > 0;
      page++;
    }

    return files;
  }

  async renameFile(fileId: string, newName: string): Promise<RenameResult> {
    return this.retryableRename(async () => {
      const response = await this.callAPI('POST', 'https://api.guangyapan.com/userres/v1/file/rename', {
        fileId,
        newName,
      }) as GuangyaPanListResponse;
      this.assertSuccessful(response.msg === 'success', response.msg, '光鸭云盘重命名失败', response);
    }, fileId, newName);
  }

  protected getCurrentFolderId(): string {
    const hash = window.location.hash;
    if (!hash) return '';

    // Hash format: #/home/all or #/home/all/<fileId-fileName>/<fileId-fileName>
    const match = hash.match(/^#\/home\/all\/(.+)$/);
    if (!match) return '';

    const segments = match[1].split('/').filter(Boolean);
    if (segments.length === 0) return '';

    const lastSegment = segments[segments.length - 1];
    // Split only at the first hyphen: ID is everything before it
    const dashIndex = lastSegment.indexOf('-');
    return dashIndex >= 0 ? lastSegment.substring(0, dashIndex) : lastSegment;
  }

  protected getPageScriptAPI(): PageScriptAPI {
    return getGuangyaPanPageScriptInjector();
  }

  protected override async callAPI(method: string, url: string, body?: unknown): Promise<unknown> {
    await this.rateLimit();
    const headers = this.buildGuangyaPanHeaders();
    return this.callGuangyaPanAPI(method, url, body, headers);
  }

  private buildGuangyaPanHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      'dt': '4',
    };

    try {
      const credentialKey = Object.keys(localStorage).find((k) => k.startsWith('credentials_'));
      if (credentialKey) {
        const credentials = JSON.parse(localStorage.getItem(credentialKey) || '{}');
        const token = credentials?.access_token || credentials?.accessToken || credentials?.token || '';
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }
    } catch { /* credentials parse failure is non-fatal */ }

    const did = localStorage.getItem('swangpan_web_device_id') || '';
    if (did) headers['did'] = did;

    const smid = localStorage.getItem('shumei_id:v1') || '';
    if (smid) headers['smid'] = smid;

    const spanId = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const traceId = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
    headers['traceparent'] = `00-${traceId}-${spanId}-01`;

    return headers;
  }

  private async callGuangyaPanAPI(
    method: string,
    url: string,
    body: unknown,
    headers: Record<string, string>,
  ): Promise<unknown> {
    const requestId = `GuangyaPan-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const response = await chrome.runtime.sendMessage({
      type: RUNTIME_MESSAGE_TYPES.GUANGYAPAN_API_REQUEST,
      requestId,
      method,
      url,
      body,
      headers,
      timeout: this.config.timeout,
    }) as { success?: boolean; data?: unknown; error?: string; status?: number };

    if (response?.success) {
      return response.data;
    }
    throw new Error(
      response?.error || `GuangyaPan API request failed with status ${response?.status ?? 'unknown'}`
    );
  }

  async getSelectedFiles(): Promise<FileItem[]> {
    try {
      // GuangyaPan rows do not expose fileId attributes on DOM elements,
      // so we need to map selected visible filenames to getAllFiles() results.
      const allFiles = await this.getAllFiles();

      // Collect selected rows by multiple strategies to handle site DOM variations.
      const selectedRows = new Set<Element>();

      // Strategy 1: rows with data-state indicating selection
      for (const row of Array.from(document.querySelectorAll(
        '.swangpan-file-list-table__row[data-state="selected"],.swangpan-file-list-table__row[data-state="checked"],.swangpan-file-list-table__row--selected'
      ))) {
        selectedRows.add(row);
      }

      // Strategy 2: rows containing a checked native checkbox input
      for (const input of Array.from(document.querySelectorAll(
        'input.swangpan-checkbox__input:checked,[aria-checked="true"]'
      ))) {
        const row = input.closest('.swangpan-file-list-table__row');
        if (row) selectedRows.add(row);
      }
      if (selectedRows.size === 0) return [];

      const selectedNames = new Set<string>();
      for (const row of selectedRows) {
        const label = row.querySelector('.swangpan-file-list-table__label');
        if (!label) continue;
        const name = (label.getAttribute('title') || label.textContent || '').trim();
        if (name) selectedNames.add(name);
      }

      return allFiles.filter((file) => selectedNames.has(file.name));
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      throw new Error(`获取选中文件失败: ${errorObj.message}`);
    }
  }

  private toFileItem(item: GuangyaPanFileItem, parentId: string): FileItem {
    const name = item.fileName || '';
    const parsed = parseFileName(name);
    const ext = item.ext || parsed.ext;
    return {
      id: String(item.fileId || ''),
      name,
      ext,
      parentId,
      size: Number(item.fileSize ?? 0) || 0,
      mtime: this.normalizeTime(item.utime ?? item.ctime),
    };
  }
}
