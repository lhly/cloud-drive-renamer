import type { FileItem, PageSyncResult, PlatformConfig, PlatformName, RenameResult } from '../../types/platform';
import { parseFileName } from '../../utils/helpers';
import { SharedCloudDriveAdapter, type PageScriptAPI } from '../shared/shared-cloud-drive-adapter';
import { getWKBrowserPageScriptInjector } from './page-script-injector';

interface WKBrowserFileItem {
  file_id: number;
  file_name: string;
  father_id: number;
  extension: string;
  is_directory: number;
  file_type: number;
  size: number;
  updated_at: number;
  created_at: number;
}

interface WKBrowserListResponse {
  code: number;
  message: string;
  data?: {
    file_list?: WKBrowserFileItem[];
    has_more?: number;
    is_share?: boolean;
  };
}

interface WKBrowserRenameResponse {
  code: number;
  message: string;
}

/**
 * WKBrowser cloud drive API error codes
 */
const WKBROWSER_ERROR_CODES: Record<number, string> = {
  0: '成功',
  60003: '文件名已存在',
  60006: '文件不存在',
  60007: '文件名非法',
  70017: '操作失败',
  30001: '操作失败',
};

function getWKBrowserErrorMessage(code: number, defaultMessage?: string): string {
  return WKBROWSER_ERROR_CODES[code] || defaultMessage || '未知错误';
}

/**
 * WKBrowser (悟空浏览器) cloud drive adapter
 *
 * API host: api.wkbrowser.com
 * UI host: pan.wkbrowser.com
 *
 * API base query params (normally injected by page axios interceptor):
 *   aid=590353&device_platform=web&language=zh
 *
 * Listing: POST /netdisk/user_file/filter_file
 * Rename:  POST /netdisk/user_file/rename_file
 */
export class WKBrowserAdapter extends SharedCloudDriveAdapter {
  readonly platform: PlatformName = 'wkbrowser';

  private static readonly API_BASE = 'https://api.wkbrowser.com';
  private static readonly BASE_PARAMS = 'aid=590353&device_platform=web&language=zh';

  constructor(config?: Partial<PlatformConfig>) {
    super({ platform: 'wkbrowser', requestInterval: 800, maxRetries: 3, timeout: 30000, ...config });
  }

  async getAllFiles(parentId?: string): Promise<FileItem[]> {
    const targetParentId = parentId ?? this.getCurrentFolderId();
    const requestParentId = this.toRequestIntId(targetParentId);
    const files: FileItem[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const url = `${WKBrowserAdapter.API_BASE}/netdisk/user_file/filter_file?offset=${offset}&limit=20&${WKBrowserAdapter.BASE_PARAMS}`;
      const response = await this.callAPI('POST', url, {
        father_id: requestParentId,
        filter_type: 2,
        is_desc: 1,
        file_type: 0,
      }) as WKBrowserListResponse;

      this.assertSuccessful(response.code === 0, response.code, getWKBrowserErrorMessage(response.code, response.message), response);

      const fileList = response.data?.file_list;
      if (!Array.isArray(fileList)) {
        throw new Error(`WKBrowser 列表获取失败: missing file_list in response`);
      }

      for (const item of fileList) {
        if (item.is_directory !== 1) {
          files.push(this.toFileItem(item, targetParentId));
        }
      }

      hasMore = response.data?.has_more === 1;
      offset += fileList.length;
    }

    return files;
  }

  async renameFile(fileId: string, newName: string): Promise<RenameResult> {
    return this.retryableRename(async () => {
      const url = `${WKBrowserAdapter.API_BASE}/netdisk/user_file/rename_file?${WKBrowserAdapter.BASE_PARAMS}`;
      const response = await this.callAPI('POST', url, {
        file_id: this.toRequestIntId(fileId),
        new_name: newName,
      }) as WKBrowserRenameResponse;

      this.assertSuccessful(response.code === 0, response.code, getWKBrowserErrorMessage(response.code, response.message), response);
    }, fileId, newName);
  }

  /**
   * Override syncAfterRename for WKBrowser Arco Table DOM.
   *
   * WKBrowser Arco rows lack data-file-id attributes; the only file_id source
   * is the checkbox input value. We locate rows by checkbox value and patch
   * the filename cell in the second td.
   */
  override async syncAfterRename(
    renames: Array<{ fileId: string; oldName?: string; newName: string }>
  ): Promise<PageSyncResult> {
    const renameInfoById = new Map<string, { oldName?: string; newName: string }>();
    for (const item of renames) {
      if (!item?.fileId || !item?.newName) continue;
      renameInfoById.set(item.fileId, { oldName: item.oldName, newName: item.newName });
    }

    if (renameInfoById.size === 0) {
      return { success: true, method: 'none' };
    }

    let patchedCount = 0;
    const allCheckboxes = document.querySelectorAll(
      '.arco-table-body input[type="checkbox"],.arco-table-body .arco-table-tr input[type="checkbox"]'
    );

    for (const checkbox of Array.from(allCheckboxes)) {
      const input = checkbox as HTMLInputElement;
      const fileId = input.value;
      if (!fileId) continue;

      const info = renameInfoById.get(fileId);
      if (!info) continue;

      const row = input.closest('tr.arco-table-tr');
      if (!row) continue;

      // Patch filename in the second td (index 1)
      const tds = row.querySelectorAll('td');
      if (tds.length < 2) continue;

      const nameCell = tds[1];
      patchedCount += this.patchFilenameCell(nameCell, info.oldName, info.newName);
    }

    // Also patch by old name across all cells for virtual rerender resilience
    const renameByOldName = new Map<string, string>();
    for (const info of renameInfoById.values()) {
      if (info.oldName) renameByOldName.set(info.oldName, info.newName);
    }
    if (renameByOldName.size > 0) {
      const arcoBody = document.querySelector('.arco-table-body') || document.body;
      patchedCount += this.patchExactTextInDoc(arcoBody, renameByOldName);
      patchedCount += this.patchAttributesInDoc(arcoBody, renameByOldName, 'title');
      patchedCount += this.patchAttributesInDoc(arcoBody, renameByOldName, 'aria-label');
    }

    if (patchedCount > 0) {
      return { success: true, method: 'dom-patch', message: `patched ${patchedCount} nodes` };
    }

    return { success: true, method: 'none', message: 'no visible WKBrowser rows to patch' };
  }

  private patchFilenameCell(cell: Element, oldName: string | undefined, newName: string): number {
    let patched = 0;

    // Try exact full-text match first
    const fullMap = new Map<string, string>();
    if (oldName) fullMap.set(oldName, newName);
    patched += this.patchExactTextInDoc(cell, fullMap);

    if (patched === 0 && oldName) {
      // Try base name / extension split match
      const oldParts = parseFileName(oldName);
      const newParts = parseFileName(newName);
      const partsMap = new Map<string, string>();
      if (oldParts.name && oldParts.name !== newParts.name) partsMap.set(oldParts.name, newParts.name);
      if (oldParts.ext && oldParts.ext !== newParts.ext) partsMap.set(oldParts.ext, newParts.ext);
      if (partsMap.size > 0) patched += this.patchExactTextInDoc(cell, partsMap);
    }

    if (patched === 0) {
      // Fallback: set textContent on first child span or the cell itself
      const target = cell.querySelector('span') || cell;
      if (target.textContent?.trim() === oldName || !oldName) {
        target.textContent = newName;
        patched++;
      }
    }

    return patched;
  }

  private patchExactTextInDoc(root: ParentNode, renameByOldName: Map<string, string>): number {
    if (renameByOldName.size === 0) return 0;
    let patched = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = node.nodeValue?.trim();
      if (!text) continue;
      const next = renameByOldName.get(text);
      if (next && node.nodeValue !== next) {
        node.nodeValue = next;
        patched++;
      }
    }
    return patched;
  }

  private patchAttributesInDoc(root: ParentNode, renameByOldName: Map<string, string>, attr: 'title' | 'aria-label'): number {
    if (renameByOldName.size === 0) return 0;
    let patched = 0;
    const nodes = Array.from(root.querySelectorAll(`[${attr}]`));
    for (const node of nodes) {
      const value = node.getAttribute(attr);
      if (!value) continue;
      const next = renameByOldName.get(value);
      if (next && value !== next) {
        node.setAttribute(attr, next);
        patched++;
      }
    }
    return patched;
  }

  /**
   * WKBrowser overrides getSelectedFiles to handle Arco Table DOM.
   *
   * Arco Design table uses:
   * - Rows: tr.arco-table-tr.h-48 inside .arco-table-body
   * - Checkboxes: input[type="checkbox"] inside checked rows (class arco-table-row-checked)
   * - Checkbox input value is the file_id
   * - Filename is in the second td's text content
   */
  override async getSelectedFiles(): Promise<FileItem[]> {
    try {
      const allFiles = await this.getAllFiles();
      const allFilesById = new Map(allFiles.map((f) => [f.id, f]));

      const checkedCheckboxes = document.querySelectorAll(
        '.arco-table-row-checked input[type="checkbox"],tr.arco-table-tr input[type="checkbox"]:checked'
      );

      if (checkedCheckboxes.length === 0) return [];

      const files: FileItem[] = [];
      for (const checkbox of Array.from(checkedCheckboxes)) {
        const input = checkbox as HTMLInputElement;
        const row = input.closest('tr.arco-table-tr');
        if (!row || row.closest('thead') || row.closest('.arco-table-header')) continue;

        const fileId = input.value;
        if (!fileId) continue;

        const matched = allFilesById.get(fileId);
        if (matched) {
          files.push(matched);
        }
      }

      return files;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      throw new Error(`获取选中文件失败: ${errorObj.message}`);
    }
  }

  protected getCurrentFolderId(): string {
    // For subdirectories, page URL search param 'path' is a URI-encoded JSON array.
    // The last item's id is the current folder's father_id.
    const urlParams = new URLSearchParams(window.location.search);
    const pathParam = urlParams.get('path');
    if (pathParam) {
      try {
        const pathArray = JSON.parse(decodeURIComponent(pathParam));
        if (Array.isArray(pathArray) && pathArray.length > 0) {
          const lastItem = pathArray[pathArray.length - 1];
          if (lastItem?.id !== undefined) {
            return String(lastItem.id);
          }
        }
      } catch {
        // Fall through to root
      }
    }

    // Root directory father_id is 0
    return '0';
  }

  protected getPageScriptAPI(): PageScriptAPI {
    return getWKBrowserPageScriptInjector();
  }

  private toRequestIntId(id: string): number | string {
    if (/^\d+$/.test(id)) {
      const numericId = Number(id);
      if (Number.isSafeInteger(numericId)) {
        return numericId;
      }
    }

    return id;
  }

  private toFileItem(item: WKBrowserFileItem, parentId: string): FileItem {
    const name = item.file_name || '';
    const ext = item.extension ? `.${item.extension}` : parseFileName(name).ext;
    // WKBrowser timestamps are Unix seconds; convert to milliseconds
    const rawTime = item.updated_at || item.created_at;
    const mtime = typeof rawTime === 'number' && rawTime > 0
      ? (rawTime < 1e12 ? rawTime * 1000 : rawTime)
      : Date.now();

    return {
      id: String(item.file_id),
      name,
      ext,
      parentId: String(item.father_id ?? parentId),
      size: Number(item.size ?? 0) || 0,
      mtime,
    };
  }
}
