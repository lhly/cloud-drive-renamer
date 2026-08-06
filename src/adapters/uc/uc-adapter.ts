import { BasePlatformAdapter } from '../base/adapter.interface';
import { FileItem, PageSyncResult, PlatformConfig, PlatformName, RenameResult } from '../../types/platform';
import { parseFileName } from '../../utils/helpers';
import { logger } from '../../utils/logger';
import { UCAPIError, getErrorMessage, isRetryableError } from './errors';
import { getUCPageScriptInjector } from './page-script-injector';

interface UCAPIResponse<T = unknown> {
  status?: number;
  code: number;
  message?: string;
  data: T;
  metadata?: {
    _total?: number;
  };
}

interface UCFileData {
  fid: string;
  file_name: string;
  pdir_fid: string;
  size?: number;
  updated_at?: number;
  format_type?: string;
  file?: boolean;
  dir?: boolean;
}

export class UCAdapter extends BasePlatformAdapter {
  readonly platform: PlatformName = 'uc';

  private baseURL = 'https://pc-api.uc.cn/1/clouddrive';
  private lastRequestTime = 0;
  private pendingConflictListRequests = new Map<string, Promise<FileItem[]>>;

  constructor(config?: Partial<PlatformConfig>) {
    super({
      platform: 'uc',
      requestInterval: 800,
      maxRetries: 3,
      timeout: 30000,
      ...config,
    });
  }

  getCurrentDirectoryKey(): string {
    return this.getCurrentFolderId();
  }

  async getSelectedFiles(): Promise<FileItem[]> {
    try {
      const checkedItems = document.querySelectorAll('.ant-checkbox-checked');
      if (checkedItems.length === 0) return [];

      const files: FileItem[] = [];
      for (const checkbox of Array.from(checkedItems)) {
        const row = checkbox.closest('tr');
        if (!row || row.closest('thead')) continue;

        const isDir = row.classList.contains('is-directory') || row.getAttribute('data-is-dir') === 'true';
        if (isDir) continue;

        const fileId = row.getAttribute('data-file-id') || row.getAttribute('data-fid') || '';
        const fileName = row.querySelector('.file-name')?.textContent?.trim() || '';
        if (!fileId || !fileName) continue;

        const sizeAttr = row.getAttribute('data-size');
        const mtimeAttr = row.getAttribute('data-mtime');
        const { ext } = parseFileName(fileName);

        files.push({
          id: fileId,
          name: fileName,
          ext,
          parentId: this.getCurrentFolderId(),
          size: sizeAttr ? Number.parseInt(sizeAttr, 10) : 0,
          mtime: mtimeAttr ? Number.parseInt(mtimeAttr, 10) : Date.now(),
        });
      }

      return files;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to get UC selected files:', errorObj);
      throw new Error(`获取选中文件失败: ${errorObj.message}`);
    }
  }

  async getAllFiles(parentId?: string): Promise<FileItem[]> {
    try {
      const targetParentId = parentId || this.getCurrentFolderId();
      const allFiles: FileItem[] = [];
      let page = 1;
      const pageSize = 100;
      let total = Number.POSITIVE_INFINITY;

      while (allFiles.length < total) {
        await this.rateLimit();

        const url = new URL(`${this.baseURL}/file/sort`);
        url.searchParams.set('pr', 'UCBrowser');
        url.searchParams.set('fr', 'pc');
        url.searchParams.set('uc_param_str', '');
        url.searchParams.set('pdir_fid', targetParentId);
        url.searchParams.set('_page', String(page));
        url.searchParams.set('_size', String(pageSize));
        url.searchParams.set('_fetch_total', '1');
        url.searchParams.set('_fetch_sub_dirs', '0');
        url.searchParams.set('_sort', 'file_type:asc,updated_at:desc');

        const response = await this.fetchWithTimeout(url.toString(), {
          method: 'GET',
          credentials: 'include',
        });
        const result: UCAPIResponse<{ list: UCFileData[] }> = await response.json();

        if (result.code !== 0 || !result.data?.list) {
          throw new UCAPIError(result.code, getErrorMessage(result.code, result.message), result);
        }

        const pageFiles = result.data.list.map((item): FileItem => {
          const isFile = item.file !== false && item.dir !== true;
          const ext = isFile ? parseFileName(item.file_name).ext : '';
          return {
            id: item.fid,
            name: item.file_name,
            ext,
            parentId: item.pdir_fid,
            size: item.size ?? 0,
            mtime: item.updated_at ?? Date.now(),
          };
        });

        allFiles.push(...pageFiles);
        total = result.metadata?._total ?? (pageFiles.length < pageSize ? allFiles.length : Number.POSITIVE_INFINITY);
        if (pageFiles.length < pageSize) break;
        page++;
      }

      return allFiles;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to get UC all files:', errorObj);
      throw new Error(`获取文件列表失败: ${errorObj.message}`);
    }
  }

  async renameFile(fileId: string, newName: string): Promise<RenameResult> {
    return this.retryableRequest(async () => {
      await this.rateLimit();

      const requestBody: Record<string, string> = {
        fid: fileId,
        file_name: newName,
      };
      const parentId = this.getCurrentFolderId();
      if (parentId && parentId !== '0') {
        requestBody.pdir_fid = parentId;
      }

      const result = await getUCPageScriptInjector().callAPI(
        'POST',
        `${this.baseURL}/file/rename`,
        requestBody,
        this.config.timeout
      ) as UCAPIResponse;

      if (result.code === 0 && (!result.status || result.status === 200)) {
        return { success: true, newName };
      }

      throw new UCAPIError(result.code, getErrorMessage(result.code, result.message), result);
    }, `重命名文件 ${fileId}`);
  }

  async checkNameConflict(fileName: string, parentId: string): Promise<boolean> {
    try {
      const files = await this.getConflictCheckFiles(parentId);
      return files.some((file) => file.name === fileName);
    } catch (error) {
      logger.error('Failed to check UC name conflict:', error instanceof Error ? error : new Error(String(error)));
      return true;
    }
  }

  async getFileInfo(fileId: string): Promise<FileItem> {
    try {
      const row = document.querySelector(`tr[data-file-id="${fileId}"]`);
      if (!row) throw new Error(`找不到文件 ID: ${fileId}`);

      const fileName = row.querySelector('.file-name')?.textContent?.trim() || '';
      const sizeAttr = row.getAttribute('data-size');
      const mtimeAttr = row.getAttribute('data-mtime');
      const { ext } = parseFileName(fileName);

      return {
        id: fileId,
        name: fileName,
        ext,
        parentId: this.getCurrentFolderId(),
        size: sizeAttr ? Number.parseInt(sizeAttr, 10) : 0,
        mtime: mtimeAttr ? Number.parseInt(mtimeAttr, 10) : Date.now(),
      };
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error(`Failed to get UC file info for ${fileId}:`, errorObj);
      throw new Error(`获取文件信息失败: ${errorObj.message}`);
    }
  }

  async syncAfterRename(
    renames: Array<{ fileId: string; oldName?: string; newName: string }>
  ): Promise<PageSyncResult> {
    const renameInfoById = new Map<string, { oldName?: string; newName: string }>();
    const renameByOldName = new Map<string, string>();

    for (const item of renames) {
      if (!item?.fileId || !item?.newName) continue;
      renameInfoById.set(item.fileId, { oldName: item.oldName, newName: item.newName });
      if (item.oldName) {
        renameByOldName.set(item.oldName, item.newName);
      }
    }

    if (renameInfoById.size === 0) {
      return { success: true, method: 'none' };
    }

    const patchedById = this.applyRenameMappingToDomById(renameInfoById);
    const patchedByOldName = this.applyRenameMappingToDomByOldName(renameByOldName);
    const patchedCount = patchedById + patchedByOldName;

    this.observeAndPatchRenamedRows(renameInfoById, renameByOldName, 15000);

    const rerender = this.tryTriggerNativeFileListRerender();
    if (rerender.triggered) {
      return { success: true, method: 'ui-refresh', message: rerender.message };
    }

    if (patchedCount > 0) {
      return { success: true, method: 'dom-patch', message: `patched ${patchedCount} nodes` };
    }

    return { success: true, method: 'none', message: 'no visible UC rows to patch' };
  }

  private applyRenameMappingToDomById(
    renameInfoById: Map<string, { oldName?: string; newName: string }>
  ): number {
    let patched = 0;
    const nodes = Array.from(document.querySelectorAll('[data-file-id],[data-fid],[data-row-key],[data-key],[data-id]'));

    for (const node of nodes) {
      const fileId =
        node.getAttribute('data-file-id') ||
        node.getAttribute('data-fid') ||
        node.getAttribute('data-row-key') ||
        node.getAttribute('data-key') ||
        node.getAttribute('data-id');
      if (!fileId) continue;

      const info = renameInfoById.get(fileId);
      if (!info) continue;

      const row = node.closest('tr,[role="row"],.ant-table-row,.file-item,.list-item') || node;
      patched += this.patchRowElement(row, info.oldName, info.newName);
    }

    return patched;
  }

  private applyRenameMappingToDomByOldName(renameByOldName: Map<string, string>): number {
    if (renameByOldName.size === 0) return 0;

    let patched = 0;
    const nodes = Array.from(document.querySelectorAll('.file-name,[title],[aria-label]'));

    for (const node of nodes) {
      for (const [oldName, newName] of renameByOldName.entries()) {
        patched += this.patchNameElement(node, oldName, newName);
      }
    }

    return patched;
  }

  private patchRowElement(row: Element, oldName: string | undefined, newName: string): number {
    const preferredNameNode = row.querySelector('.file-name');
    if (preferredNameNode && oldName) {
      return this.patchStructuredNameWithinElement(preferredNameNode, oldName, newName);
    }

    let patched = 0;
    const candidates = Array.from(row.querySelectorAll('[title],[aria-label]'));
    for (const candidate of candidates) {
      patched += this.patchNameElement(candidate, oldName, newName);
    }
    return patched;
  }

  private patchNameElement(node: Element, oldName: string | undefined, newName: string): number {
    if (!oldName) return 0;
    return this.patchStructuredNameWithinElement(node, oldName, newName);
  }

  private patchStructuredNameWithinElement(root: Element, oldName: string, newName: string): number {
    const fullMap = new Map([[oldName, newName]]);
    let patched = this.patchExactTextInElement(root, fullMap);

    if (patched === 0) {
      const oldParts = parseFileName(oldName);
      const newParts = parseFileName(newName);
      const partsMap = new Map<string, string>();

      if (oldParts.name && oldParts.name !== newParts.name) {
        partsMap.set(oldParts.name, newParts.name);
      }
      if (oldParts.ext && oldParts.ext !== newParts.ext) {
        partsMap.set(oldParts.ext, newParts.ext);
      }

      patched += this.patchExactTextInElement(root, partsMap);
    }

    patched += this.patchAttributesInElement(root, fullMap, 'title');
    patched += this.patchAttributesInElement(root, fullMap, 'aria-label');
    return patched;
  }

  private patchExactTextInElement(root: Node, renameByOldName: Map<string, string>): number {
    if (renameByOldName.size === 0) return 0;

    let patched = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const text = node.nodeValue?.trim();
        if (!text) return NodeFilter.FILTER_SKIP;
        return renameByOldName.has(text) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      },
    });

    let node: Node | null;
    while ((node = walker.nextNode())) {
      const oldText = node.nodeValue?.trim();
      if (!oldText) continue;
      const next = renameByOldName.get(oldText);
      if (!next) continue;
      if (node.nodeValue !== next) {
        node.nodeValue = next;
        patched++;
      }
    }

    return patched;
  }

  private patchAttributesInElement(
    root: Element,
    renameByOldName: Map<string, string>,
    attributeName: 'title' | 'aria-label'
  ): number {
    if (renameByOldName.size === 0) return 0;

    let patched = 0;
    const nodes = [root, ...Array.from(root.querySelectorAll(`[${attributeName}]`))];
    for (const node of nodes) {
      const value = node.getAttribute(attributeName);
      if (!value) continue;
      const next = renameByOldName.get(value);
      if (!next) continue;

      if (value !== next) {
        node.setAttribute(attributeName, next);
        patched++;
      }
    }
    return patched;
  }

  private observeAndPatchRenamedRows(
    renameInfoById: Map<string, { oldName?: string; newName: string }>,
    renameByOldName: Map<string, string>,
    durationMs: number
  ): void {
    if (!document.body || typeof MutationObserver === 'undefined') return;

    const observer = new MutationObserver(() => {
      this.applyRenameMappingToDomById(renameInfoById);
      this.applyRenameMappingToDomByOldName(renameByOldName);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['title', 'aria-label'],
    });

    window.setTimeout(() => observer.disconnect(), durationMs);
  }

  private tryTriggerNativeFileListRerender(): { triggered: boolean; message?: string } {
    const controls = Array.from(document.querySelectorAll('button,[role="button"],[title],[aria-label]'));
    const refreshControl = controls.find((control) => {
      const text = control.textContent?.trim() || '';
      const title = control.getAttribute('title') || '';
      const ariaLabel = control.getAttribute('aria-label') || '';
      return /刷新|refresh/i.test(`${text} ${title} ${ariaLabel}`);
    });

    if (refreshControl instanceof HTMLElement) {
      refreshControl.click();
      return { triggered: true, message: 'triggered UC native refresh control' };
    }

    return { triggered: false };
  }

  private getConflictCheckFiles(parentId: string): Promise<FileItem[]> {
    const pendingRequest = this.pendingConflictListRequests.get(parentId);
    if (pendingRequest) {
      return pendingRequest;
    }

    const request = this.getAllFiles(parentId).finally(() => {
      this.pendingConflictListRequests.delete(parentId);
    });
    this.pendingConflictListRequests.set(parentId, request);
    return request;
  }

  private getCurrentFolderId(): string {
    const urlParams = new URLSearchParams(window.location.search);
    const dirId = urlParams.get('dir_id') || urlParams.get('pdir_fid');
    if (dirId) return dirId;

    const hash = window.location.hash || '';
    if (hash) {
      const hashPath = hash.split('?')[0];
      const normalized = hashPath
        .replace(/^#/, '')
        .replace(/^\/list\/(?:all|folder)/, '')
        .replace(/^\/+/, '')
        .replace(/\/+$/, '');

      if (normalized) {
        const segments = normalized.split('/').filter(Boolean);
        const lastSegment = segments[segments.length - 1];
        const idMatch = lastSegment?.match(/^([a-zA-Z0-9]+)/);
        if (idMatch?.[1]) return idMatch[1];
      }
    }

    const dirElement = document.querySelector('[data-dir-id]');
    const domDirId = dirElement?.getAttribute('data-dir-id');
    return domDirId || '0';
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    const waitTime = this.config.requestInterval - elapsed;
    if (waitTime > 0) await this.sleep(waitTime);
    this.lastRequestTime = Date.now();
  }

  private async retryableRequest<T extends RenameResult>(requestFn: () => Promise<T>, operation: string): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;
        if (!isRetryableError(error) || attempt === this.config.maxRetries) {
          break;
        }
        const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        logger.warn(`${operation} 失败（第 ${attempt}/${this.config.maxRetries} 次尝试），${backoffDelay}ms 后重试:`, error instanceof Error ? error : new Error(String(error)));
        await this.sleep(backoffDelay);
      }
    }

    return {
      success: false,
      error: lastError instanceof Error ? lastError : new Error(String(lastError)),
    } as T;
  }
}
