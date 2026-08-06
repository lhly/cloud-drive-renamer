import type { FileItem, PageSyncResult, PlatformConfig, PlatformName, RenameResult } from '../../types/platform';
import { BasePlatformAdapter } from '../base/adapter.interface';
import { logger } from '../../utils/logger';
import { parseFileName } from '../../utils/helpers';

export interface PageScriptAPI {
  callAPI(method: string, url: string, body?: unknown, timeout?: number): Promise<unknown>;
}

export class CloudDriveAPIError extends Error {
  constructor(
    public readonly code: string | number | undefined,
    message: string,
    public readonly response?: unknown
  ) {
    super(message);
    this.name = 'CloudDriveAPIError';
  }
}

export abstract class SharedCloudDriveAdapter extends BasePlatformAdapter {
  private lastRequestTime = 0;
  private pendingConflictListRequests = new Map<string, Promise<FileItem[]>>;

  protected constructor(config: Partial<PlatformConfig>) {
    super({
      requestInterval: 800,
      maxRetries: 3,
      timeout: 30000,
      ...config,
    });
  }

  abstract readonly platform: PlatformName;
  protected abstract getCurrentFolderId(): string;
  protected abstract getPageScriptAPI(): PageScriptAPI;

  getCurrentDirectoryKey(): string {
    return this.getCurrentFolderId();
  }

  async getSelectedFiles(): Promise<FileItem[]> {
    try {
      const checkedItems = document.querySelectorAll('.ant-checkbox-checked,.is-checked input[type="checkbox"],input[type="checkbox"]:checked');
      if (checkedItems.length === 0) return [];

      const files: FileItem[] = [];
      for (const checkbox of Array.from(checkedItems)) {
        const row = checkbox.closest('tr,[role="row"],.ant-table-row,.file-item,.list-item,[data-file-id],[data-fid],[data-id]');
        if (!row || row.closest('thead')) continue;

        const isDir =
          row.classList.contains('is-directory') ||
          row.getAttribute('data-is-dir') === 'true' ||
          row.getAttribute('data-type') === 'folder' ||
          row.getAttribute('data-dir') === 'true';
        if (isDir) continue;

        const fileId =
          row.getAttribute('data-file-id') ||
          row.getAttribute('data-fid') ||
          row.getAttribute('data-fileid') ||
          row.getAttribute('data-row-key') ||
          row.getAttribute('data-key') ||
          row.getAttribute('data-id') ||
          '';
        const fileName = this.findFilenameInRow(row);
        if (!fileId || !fileName) continue;

        const sizeAttr = row.getAttribute('data-size');
        const mtimeAttr = row.getAttribute('data-mtime') || row.getAttribute('data-updated-at');
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
      logger.error(`Failed to get ${this.platform} selected files:`, errorObj);
      throw new Error(`获取选中文件失败: ${errorObj.message}`);
    }
  }

  async checkNameConflict(fileName: string, parentId: string): Promise<boolean> {
    try {
      const files = await this.getConflictCheckFiles(parentId);
      return files.some((file) => file.name === fileName);
    } catch (error) {
      logger.error(`Failed to check ${this.platform} name conflict:`, error instanceof Error ? error : new Error(String(error)));
      return true;
    }
  }

  async getFileInfo(fileId: string): Promise<FileItem> {
    try {
      const selector = `[data-file-id="${this.escapeAttribute(fileId)}"],[data-fid="${this.escapeAttribute(fileId)}"],[data-id="${this.escapeAttribute(fileId)}"]`;
      const row = document.querySelector(selector);
      if (!row) throw new Error(`找不到文件 ID: ${fileId}`);

      const fileName = this.findFilenameInRow(row);
      const sizeAttr = row.getAttribute('data-size');
      const mtimeAttr = row.getAttribute('data-mtime') || row.getAttribute('data-updated-at');
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
      logger.error(`Failed to get ${this.platform} file info for ${fileId}:`, errorObj);
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
      if (item.oldName) renameByOldName.set(item.oldName, item.newName);
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

    return { success: true, method: 'none', message: `no visible ${this.platform} rows to patch` };
  }

  protected async callAPI(method: string, url: string, body?: unknown): Promise<unknown> {
    await this.rateLimit();
    return this.getPageScriptAPI().callAPI(method, url, body, this.config.timeout);
  }

  protected async retryableRename(requestFn: () => Promise<void>, fileId: string, newName: string): Promise<RenameResult> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        await requestFn();
        return { success: true, newName };
      } catch (error) {
        lastError = error;
        if (!this.isRetryableError(error) || attempt === this.config.maxRetries) break;
        const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        logger.warn(`重命名文件 ${fileId} 失败（第 ${attempt}/${this.config.maxRetries} 次尝试），${backoffDelay}ms 后重试:`, error instanceof Error ? error : new Error(String(error)));
        await this.sleep(backoffDelay);
      }
    }

    return {
      success: false,
      error: lastError instanceof Error ? lastError : new Error(String(lastError)),
    };
  }

  protected assertSuccessful(condition: boolean, code: string | number | undefined, message: string, response?: unknown): void {
    if (!condition) {
      throw new CloudDriveAPIError(code, message || 'request failed', response);
    }
  }

  protected normalizeTime(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const numeric = Number(value);
      if (Number.isFinite(numeric) && numeric > 0) return numeric;
      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return Date.now();
  }

  private async getConflictCheckFiles(parentId: string): Promise<FileItem[]> {
    const pendingRequest = this.pendingConflictListRequests.get(parentId);
    if (pendingRequest) return pendingRequest;

    const request = this.getAllFiles(parentId).finally(() => {
      this.pendingConflictListRequests.delete(parentId);
    });
    this.pendingConflictListRequests.set(parentId, request);
    return request;
  }

  private applyRenameMappingToDomById(renameInfoById: Map<string, { oldName?: string; newName: string }>): number {
    let patched = 0;
    const nodes = Array.from(document.querySelectorAll('[data-file-id],[data-fid],[data-fileid],[data-row-key],[data-key],[data-id]'));

    for (const node of nodes) {
      const fileId =
        node.getAttribute('data-file-id') ||
        node.getAttribute('data-fid') ||
        node.getAttribute('data-fileid') ||
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
    const nodes = Array.from(document.querySelectorAll('.file-name,.filename,.name,[title],[aria-label]'));
    for (const node of nodes) {
      for (const [oldName, newName] of renameByOldName.entries()) {
        patched += this.patchNameElement(node, oldName, newName);
      }
    }
    return patched;
  }

  private patchRowElement(row: Element, oldName: string | undefined, newName: string): number {
    const preferredNameNode = row.querySelector('.file-name,.filename,.name');
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
      if (oldParts.name && oldParts.name !== newParts.name) partsMap.set(oldParts.name, newParts.name);
      if (oldParts.ext && oldParts.ext !== newParts.ext) partsMap.set(oldParts.ext, newParts.ext);
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

  private patchAttributesInElement(root: Element, renameByOldName: Map<string, string>, attributeName: 'title' | 'aria-label'): number {
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

  private observeAndPatchRenamedRows(renameInfoById: Map<string, { oldName?: string; newName: string }>, renameByOldName: Map<string, string>, durationMs: number): void {
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
      return /刷新|refresh|重新加载|reload/i.test(`${text} ${title} ${ariaLabel}`);
    });

    if (refreshControl instanceof HTMLElement) {
      refreshControl.click();
      return { triggered: true, message: `triggered ${this.platform} native refresh control` };
    }
    return { triggered: false };
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    const waitTime = this.config.requestInterval - elapsed;
    if (waitTime > 0) await this.sleep(waitTime);
    this.lastRequestTime = Date.now();
  }

  private findFilenameInRow(row: Element): string {
    return (
      row.querySelector('.file-name,.filename,.name,[title]')?.textContent?.trim() ||
      row.getAttribute('title') ||
      row.getAttribute('aria-label') ||
      ''
    );
  }

  private escapeAttribute(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  private isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    if (/timeout|network|fetch|abort/i.test(error.message)) return true;
    if (error instanceof CloudDriveAPIError) {
      const numericCode = Number(error.code);
      return numericCode === 429 || numericCode >= 500;
    }
    return false;
  }
}
