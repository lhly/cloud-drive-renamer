import { BasePlatformAdapter } from '../base/adapter.interface';
import { PlatformName, FileItem, RenameResult, PlatformConfig, PageSyncResult } from '../../types/platform';
import { parseFileName } from '../../utils/helpers';
import { BaiduAPIError, getErrorMessage, isRetryableError } from './errors';
import { getPageScriptInjector } from './page-script-injector';
import { logger } from '../../utils/logger';

/**
 * Baidu API Response Format
 */
interface BaiduAPIResponse<T = any> {
  errno: number;
  info?: any[];
  request_id?: number;
  taskid?: number;
  data?: T;
  // Some endpoints (e.g. /api/list) return `list` at top-level instead of inside `data`.
  list?: any[];
}

/**
 * Baidu Task Query Response
 */
interface BaiduTaskResponse {
  errno: number;
  status: 'running' | 'pending' | 'success' | 'failed';
  taskid: number;
}

/**
 * Baidu File List Item
 */
interface BaiduFileListItem {
  path: string;
  server_filename: string;
  fs_id: number;          // Critical: required for rename
  md5: string;
  isdir: 0 | 1;
  size: number;
  server_mtime?: number;
}

/**
 * Baidu Drive Platform Adapter
 * Based on verified API exploration 2025-12-19
 *
 * API Documentation:
 * - Base URL: https://pan.baidu.com/api
 * - Auth: Cookie (BDUSS, STOKEN) + bdstoken URL parameter
 * - Rate Limit: 800ms interval recommended
 * - Async Operations: Rename returns taskid, requires polling
 */
export class BaiduAdapter extends BasePlatformAdapter {
  readonly platform: PlatformName = 'baidu';

  private baseURL = 'https://pan.baidu.com/api';
  private lastRequestTime = 0;
  private maxTaskPollAttempts = 30;      // Max 30 attempts
  private taskPollInterval = 1000;        // 1 second polling interval

  constructor(config?: Partial<PlatformConfig>) {
    super({
      platform: 'baidu',
      requestInterval: 800,     // Baidu API rate limit
      maxRetries: 3,
      timeout: 30000,
      ...config,
    });
  }

  /**
   * Get currently selected files from Baidu Drive DOM
   */
  async getSelectedFiles(): Promise<FileItem[]> {
    try {
      // ✅ 使用正确的选择器 - 基于实际DOM分析 (2025-12-19)
      // 百度网盘通过 is-checked 类标识选中的checkbox
      // 从checkbox回溯到tr元素获取文件信息
      const checkboxes = document.querySelectorAll('tbody label.u-checkbox.is-checked');
      const selectedRows: Element[] = [];

      // 从checkbox回溯到文件行tr
      checkboxes.forEach(checkbox => {
        const tr = checkbox.closest('tr');
        if (tr) {
          selectedRows.push(tr);
        }
      });

      if (selectedRows.length === 0) {
        return [];
      }

      const files: FileItem[] = [];

      for (const row of selectedRows) {
        // Extract fs_id from data attributes
        const fsId = row.getAttribute('data-fs-id') ||
                     row.getAttribute('data-id') ||
                     '';

        // Extract filename from DOM
        // 优先从 title 属性获取完整文件名（避免被省略号截断）
        const filenameEl = row.querySelector('.wp-s-pan-list__file-name-title-text, .list-name-text, a[title]');
        const fileName = filenameEl?.getAttribute('title')?.trim() || filenameEl?.textContent?.trim() || '';

        // Check if directory (skip folders)
        const isDir = row.getAttribute('data-isdir') === '1' ||
                      row.classList.contains('is-directory');

        if (isDir) {
          continue;
        }

        // Skip files with empty names
        if (!fileName) {
          logger.warn('Empty fileName detected, skipping row');
          continue;
        }

        // Use getCurrentPath() to get parent directory path
        // Current directory IS the parent directory for selected files
        const parentPath = this.getCurrentPath();

        // Parse extension
        const { ext } = parseFileName(fileName);

        // Extract size and mtime
        const sizeAttr = row.getAttribute('data-size');
        const mtimeAttr = row.getAttribute('data-mtime');

        files.push({
          id: fsId,
          name: fileName,
          ext: ext,
          parentId: parentPath,
          size: sizeAttr ? parseInt(sizeAttr, 10) : 0,
          mtime: mtimeAttr ? parseInt(mtimeAttr, 10) : Date.now(),
        });
      }

      return files;
    } catch (error) {
      logger.error('Failed to get selected files:', error instanceof Error ? error : new Error(String(error)));
      throw new Error(`获取选中文件失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get all files in the current directory via API
   * This method bypasses DOM parsing and directly fetches from platform API
   * Used to solve the virtual scrolling file loss issue
   *
   * @param parentPath Parent directory path (optional, defaults to current directory)
   * @returns Complete file list
   */
  async getAllFiles(parentPath?: string): Promise<FileItem[]> {
    try {
      logger.info('[BaiduAdapter] Fetching all files from API');

      const targetPath = parentPath || this.getCurrentPath();
      const bdstoken = await this.extractBdstoken();

      if (!bdstoken) {
        throw new Error('无法获取 bdstoken，请确保已登录百度网盘');
      }

      const allFiles: FileItem[] = [];
      let page = 1;
      const pageSize = 100;
      let hasMore = true;

      // Paginate through all files
      while (hasMore) {
        await this.rateLimit();

        const url = new URL(`${this.baseURL}/list`);
        url.searchParams.set('order', 'name');
        url.searchParams.set('desc', '0');
        url.searchParams.set('page', page.toString());
        url.searchParams.set('num', pageSize.toString());
        url.searchParams.set('dir', targetPath);
        url.searchParams.set('bdstoken', bdstoken);

        const response = await this.fetchWithTimeout(url.toString(), {
          method: 'GET',
          credentials: 'include',
        });

        const result: BaiduAPIResponse<{ list: BaiduFileListItem[] }> = await response.json();

        if (result.errno !== 0) {
          const errorMsg = getErrorMessage(result.errno);
          throw new BaiduAPIError(result.errno, errorMsg, result);
        }

        const pageFiles = (result.data?.list ?? result.list) as BaiduFileListItem[] | undefined;
        if (!Array.isArray(pageFiles)) {
          throw new Error('无法解析文件列表响应');
        }

        // Filter out folders (only return files, isdir === 0)
        const files = pageFiles
          .filter(f => f.isdir === 0)
          .map((file): FileItem => {
            const { ext } = parseFileName(file.server_filename);
            return {
              id: String(file.fs_id),
              name: file.server_filename,
              ext: ext,
              parentId: targetPath,
              size: file.size,
              mtime: file.server_mtime ? file.server_mtime * 1000 : Date.now(),
            };
          });

        allFiles.push(...files);

        // Check if there are more pages
        hasMore = pageFiles.length === pageSize;
        page++;

        logger.debug(`[BaiduAdapter] Fetched page ${page - 1} with ${files.length} files`);
      }

      logger.info(`[BaiduAdapter] Successfully fetched ${allFiles.length} files`);
      return allFiles;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to get all files:', errorObj);
      throw new Error(`获取文件列表失败: ${errorObj.message}`);
    }
  }

  /**
   * Rename a file via Baidu API with async task tracking
   *
   * @param fileId - fs_id (number as string)
   * @param newName - New filename (name only, not full path)
   * @returns Rename result
   */
  async renameFile(fileId: string, newName: string): Promise<RenameResult> {
    return this.retryableRequest(async () => {
      // Apply rate limiting
      await this.rateLimit();

      // Get bdstoken from page (async via MAIN world)
      const bdstoken = await this.extractBdstoken();
      if (!bdstoken) {
        logger.error('bdstoken extraction failed');
        throw new Error('无法获取 bdstoken，请确保已登录百度网盘');
      }

      // Get file info to construct full path
      const fileInfo = await this.getFileInfoFromDOM(fileId);
      const filePath = fileInfo.parentId ? `${fileInfo.parentId}/${fileInfo.name}` : `/${fileInfo.name}`;

      // Construct rename request
      const url = `${this.baseURL}/filemanager?async=2&onnest=fail&opera=rename&bdstoken=${bdstoken}&clienttype=0&app_id=250528&web=1`;

      const requestBody = {
        filelist: JSON.stringify([{
          id: parseInt(fileId, 10),    // fs_id as number
          path: filePath,               // Full path
          newname: newName              // Name only
        }])
      };

      // Use page script injector for cookie authentication
      const injector = getPageScriptInjector();
      const result: BaiduAPIResponse = await injector.callAPI(
        'POST',
        url,
        requestBody,
        this.config.timeout
      );

      // Check immediate response
      if (result.errno !== 0) {
        const errorMsg = getErrorMessage(result.errno);
        logger.error(`API returned error - errno: ${result.errno}`, new Error(errorMsg));
        throw new BaiduAPIError(result.errno, errorMsg, result);
      }

      // Extract taskid for async tracking
      const taskid = result.taskid;
      if (!taskid) {
        logger.error('No taskid returned', new Error('重命名请求成功但未返回 taskid'));
        throw new Error('重命名请求成功但未返回 taskid');
      }

      // Poll task status until completion
      const taskResult = await this.pollTaskStatus(taskid);

      if (taskResult.status === 'success') {
        return {
          success: true,
          newName: newName,
        };
      } else {
        logger.error(`Task execution failed - taskid: ${taskid}, status: ${taskResult.status}`, new Error(`任务执行失败: ${taskResult.status}`));
        throw new Error(`任务执行失败: ${taskResult.status}`);
      }
    }, `重命名文件 ${fileId}`);
  }

  /**
   * Sync page file list after rename so users can see updated names without manual refresh.
   *
   * Strategy:
   * - Always patch visible DOM (best-effort) for immediate feedback
   * - Observe and patch for a short window (virtualized list)
   * - Best-effort trigger native list reload (observed calling /api/list)
   */
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

    const rerender = await this.tryTriggerNativeFileListRerender();
    if (rerender.triggered) {
      return { success: true, method: 'ui-refresh', message: rerender.message };
    }

    if (patchedCount > 0) {
      return { success: true, method: 'dom-patch', message: `patched ${patchedCount} nodes` };
    }

    return {
      success: false,
      method: 'none',
      message: 'failed to locate filename nodes on page',
    };
  }

  /**
   * Check if filename conflicts with existing files
   *
   * @param fileName - Filename to check
   * @param parentPath - Parent directory path
   * @returns True if conflict exists
   */
  async checkNameConflict(fileName: string, parentPath: string): Promise<boolean> {
    try {
      await this.rateLimit();

      const bdstoken = await this.extractBdstoken();
      if (!bdstoken) {
        logger.warn('Cannot check conflict: bdstoken not found');
        return true; // Conservative approach
      }

      // Query file list in parent directory
      const url = new URL(`${this.baseURL}/list`);
      url.searchParams.set('order', 'name');
      url.searchParams.set('desc', '0');
      url.searchParams.set('page', '1');
      url.searchParams.set('num', '100');
      url.searchParams.set('dir', parentPath || '/');
      url.searchParams.set('bdstoken', bdstoken);

      const response = await this.fetchWithTimeout(url.toString(), {
        method: 'GET',
        credentials: 'include',
      });

      const result: BaiduAPIResponse<{ list: BaiduFileListItem[] }> = await response.json();

      if (result.errno !== 0) {
        return false;
      }

      const list = (result.data?.list ?? result.list) as BaiduFileListItem[] | undefined;
      if (!Array.isArray(list)) {
        return false;
      }

      return list.some(file => file.server_filename === fileName);
    } catch (error) {
      logger.error('Failed to check name conflict:', error instanceof Error ? error : new Error(String(error)));
      return true; // Conservative on error
    }
  }

  /**
   * Get file information (fallback to DOM extraction)
   *
   * @param fileId - fs_id
   * @returns File information
   */
  async getFileInfo(fileId: string): Promise<FileItem> {
    try {
      // Try DOM extraction first (more reliable)
      return await this.getFileInfoFromDOM(fileId);
    } catch (error) {
      logger.error(`Failed to get file info for ${fileId}:`, error instanceof Error ? error : new Error(String(error)));
      throw new Error(`获取文件信息失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extract file info from DOM by fs_id
   * @private
   */
  private async getFileInfoFromDOM(fileId: string): Promise<FileItem> {
    const row = document.querySelector(
      `[data-fs-id="${fileId}"], [data-id="${fileId}"]`
    );

    if (!row) {
      logger.error(`Row not found for fileId: ${fileId}`, new Error(`Row not found for fileId: ${fileId}`));
      // Return fallback instead of throwing to prevent content script crash
      return {
        id: fileId,
        name: `unknown_${fileId}`,
        ext: '',
        size: 0,
        mtime: Date.now(),
        parentId: this.getCurrentPath(),
      };
    }

    // FIX: Synchronize selector with getSelectedFiles() method (line 102-103)
    // Use same selector and extraction logic to ensure consistency
    const filenameEl = row.querySelector('.wp-s-pan-list__file-name-title-text, .list-name-text, a[title]');
    const fileName = filenameEl?.getAttribute('title')?.trim() || filenameEl?.textContent?.trim() || '';

    // Safety check: log error and return fallback if filename is empty
    if (!fileName) {
      logger.error(`Empty fileName after extraction for fileId: ${fileId}`, new Error(`Empty fileName after extraction`));
      // Return fallback instead of throwing to prevent content script crash
      const parentPath = this.getCurrentPath();
      return {
        id: fileId,
        name: `unknown_${fileId}`,
        ext: '',
        size: 0,
        mtime: Date.now(),
        parentId: parentPath,
      };
    }

    // Use getCurrentPath() to get current directory path
    // Current directory IS the parent directory for selected files
    const parentPath = this.getCurrentPath();

    const sizeAttr = row.getAttribute('data-size');
    const mtimeAttr = row.getAttribute('data-mtime');
    const { ext } = parseFileName(fileName);

    return {
      id: fileId,
      name: fileName,
      ext: ext,
      parentId: parentPath,
      size: sizeAttr ? parseInt(sizeAttr, 10) : 0,
      mtime: mtimeAttr ? parseInt(mtimeAttr, 10) : Date.now(),
    };
  }

  /**
   * Extract bdstoken from page through MAIN world
   * @private
   */
  private async extractBdstoken(): Promise<string | null> {
    // Method 1: Get from MAIN world through page script (PRIMARY method)
    try {
      const injector = getPageScriptInjector();
      const bdstoken = await injector.getBdstoken();

      if (bdstoken) {
        return bdstoken;
      }
    } catch (error) {
      logger.error('Error getting bdstoken from MAIN world', error instanceof Error ? error : new Error(String(error)));
    }

    // Method 2: From URL parameter (fallback for share links)
    const urlParams = new URLSearchParams(window.location.search);
    const bdstoken = urlParams.get('bdstoken');
    if (bdstoken) {
      return bdstoken;
    }

    logger.error('bdstoken extraction failed - all methods exhausted');
    return null;
  }

  /**
   * Extract current directory path from URL
   * Similar to Quark adapter's getCurrentFolderId() method
   * @private
   */
  private getCurrentPath(): string {
    // Priority 1: URL query parameter ?path=/xxx
    const urlParams = new URLSearchParams(window.location.search);
    const pathFromQuery = urlParams.get('path');

    if (pathFromQuery) {
      try {
        const decoded = decodeURIComponent(pathFromQuery);
        return decoded;
      } catch (error) {
        logger.warn('[CDR] [WARN] Path decode failed, using raw value', {
          rawPath: pathFromQuery,
          error: error instanceof Error ? error.message : String(error),
        });
        return pathFromQuery;
      }
    }

    // Priority 2: URL hash #/all?path=/xxx
    const hash = window.location.hash;
    if (hash) {
      const hashMatch = hash.match(/[?&]path=([^&]*)/);
      if (hashMatch && hashMatch[1]) {
        try {
          const decoded = decodeURIComponent(hashMatch[1]);
          return decoded;
        } catch (error) {
          logger.warn('[CDR] [WARN] Hash path decode failed, using raw value', {
            rawPath: hashMatch[1],
            error: error instanceof Error ? error.message : String(error),
          });
          return hashMatch[1];
        }
      }
    }

    // Priority 3: Default root directory
    return '/';
  }

  private async tryTriggerNativeFileListRerender(): Promise<{ triggered: boolean; message: string }> {
    try {
      const refreshStrategy = this.tryTriggerFileListRefresh();
      if (refreshStrategy) {
        return { triggered: true, message: `triggered refresh (${refreshStrategy})` };
      }

      const sortToggled = await this.tryTriggerSortToggleRefresh();
      if (sortToggled) {
        return { triggered: true, message: 'triggered sort toggle' };
      }

      const routeNudged = this.tryTriggerRouteNudgeRefresh();
      if (routeNudged) {
        return { triggered: true, message: 'triggered route nudge' };
      }

      return { triggered: false, message: 'no native rerender trigger matched' };
    } catch (error) {
      logger.debug('[BaiduAdapter] Failed to trigger native rerender:', error instanceof Error ? error : new Error(String(error)));
      return { triggered: false, message: 'native rerender trigger failed' };
    }
  }

  private getFileListSearchRoot(): ParentNode {
    const row =
      (document.querySelector('tr[data-fs-id],tr[data-id]') as HTMLElement | null) ||
      (document.querySelector('tbody tr') as HTMLElement | null);

    const table = row?.closest('table,[role="table"],[class*="table"],[class*="Table"]') || null;
    if (table?.parentElement) {
      return table.parentElement;
    }

    return document;
  }

  private dispatchSyntheticClick(el: HTMLElement): void {
    try {
      el.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
        })
      );
    } catch {
      el.click();
    }
  }

  private tryTriggerFileListRefresh(): 'icon' | 'label' | 'text' | null {
    try {
      const root = this.getFileListSearchRoot();

      const icon = (root as ParentNode).querySelector?.(
        '.anticon-reload,.anticon-sync,[data-icon="reload"],[data-icon="sync"],.icon-refresh,.icon-reload,.u-icon-refresh,.u-icon-reload,[class*="refresh"],[class*="reload"]'
      ) as HTMLElement | null;
      if (icon) {
        this.dispatchSyntheticClick(icon);
        return 'icon';
      }

      const byLabel = (root as ParentNode).querySelector?.(
        '[title*="刷新"],[aria-label*="刷新"],[title*="重载"],[aria-label*="重载"],[title*="重新加载"],[aria-label*="重新加载"]'
      ) as HTMLElement | null;
      if (byLabel) {
        this.dispatchSyntheticClick(byLabel);
        return 'label';
      }

      const candidates = Array.from(
        (root as ParentNode).querySelectorAll?.('button,[role="button"],a,span,div') || []
      ) as HTMLElement[];
      const textMatch = candidates.find((el) => {
        // Avoid clicking file rows
        if (el.closest('tbody')) return false;
        const text = (el.textContent || '').trim();
        return text === '刷新' || text === '重载' || text === '重新加载';
      });
      if (textMatch) {
        this.dispatchSyntheticClick(textMatch);
        return 'text';
      }

      return null;
    } catch (error) {
      logger.debug('[BaiduAdapter] Failed to trigger list refresh:', error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  private async tryTriggerSortToggleRefresh(): Promise<boolean> {
    try {
      const root = this.getFileListSearchRoot();

      const headers = Array.from(
        (root as ParentNode).querySelectorAll?.('thead th,[role="columnheader"]') || []
      ) as HTMLElement[];

      const pickHeader = (re: RegExp) =>
        headers.find((h) => re.test((h.textContent || '').trim())) || null;

      const header =
        pickHeader(/文件名|名称|name/i) ||
        pickHeader(/修改时间|更新时间|时间|time|modified|updated/i) ||
        headers[0] ||
        null;

      if (!header) return false;

      const initial = this.getSortState(header);

      this.dispatchSyntheticClick(header);
      await this.sleep(250);

      // Attempt to restore sort state (best-effort, bounded)
      for (let i = 0; i < 3; i++) {
        if (this.getSortState(header) === initial) break;
        this.dispatchSyntheticClick(header);
        await this.sleep(250);
      }

      return true;
    } catch (error) {
      logger.debug('[BaiduAdapter] Failed to toggle sort for refresh:', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  private tryTriggerRouteNudgeRefresh(): boolean {
    try {
      const key = '__cdr_sync';
      const url = new URL(window.location.href);

      const hash = url.hash || '';
      const [hashPath, hashQuery = ''] = hash.split('?');
      const params = new URLSearchParams(hashQuery);
      const previous = params.get(key);
      params.set(key, String(Date.now()));

      url.hash = `${hashPath}?${params.toString()}`;
      history.replaceState(history.state, '', url.toString());
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));

      window.setTimeout(() => {
        try {
          const next = new URL(window.location.href);
          const nextHash = next.hash || '';
          const [nextHashPath, nextHashQuery = ''] = nextHash.split('?');
          const nextParams = new URLSearchParams(nextHashQuery);
          if (previous === null) {
            nextParams.delete(key);
          } else {
            nextParams.set(key, previous);
          }
          next.hash = `${nextHashPath}?${nextParams.toString()}`;
          history.replaceState(history.state, '', next.toString());
          window.dispatchEvent(new HashChangeEvent('hashchange'));
          window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
        } catch {
          // ignore
        }
      }, 500);

      return true;
    } catch (error) {
      logger.debug('[BaiduAdapter] Failed to nudge route for refresh:', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  private getSortState(header: Element): string {
    const aria = header.getAttribute('aria-sort');
    if (aria) return aria;

    const data =
      header.getAttribute('data-sort') ||
      header.getAttribute('data-order') ||
      header.getAttribute('data-direction');
    if (data) return data;

    const cls = (header.getAttribute('class') || '').toLowerCase();
    if (/(asc|ascending|sort-up|up)/.test(cls)) return 'asc';
    if (/(desc|descending|sort-down|down)/.test(cls)) return 'desc';

    if (header.querySelector('.u-icon-arrow-up,[class*="arrow-up"],[class*="sort-up"],[class*="asc"]')) {
      return 'asc';
    }
    if (header.querySelector('.u-icon-arrow-down,[class*="arrow-down"],[class*="sort-down"],[class*="desc"]')) {
      return 'desc';
    }

    return 'none';
  }

  private applyRenameMappingToDomById(
    renameInfoById: Map<string, { oldName?: string; newName: string }>
  ): number {
    if (renameInfoById.size === 0) return 0;

    let patched = 0;

    for (const [fileId, info] of renameInfoById.entries()) {
      const row = this.findRowByFileId(fileId);
      if (!row) continue;
      patched += this.patchRowElement(row, info.oldName, info.newName);
    }

    return patched;
  }

  private applyRenameMappingToDomByOldName(renameByOldName: Map<string, string>): number {
    if (renameByOldName.size === 0) return 0;

    let patched = 0;
    const root = this.getFileListSearchRoot();

    // Patch attributes/text for elements that explicitly reference the old name.
    for (const [oldName, newName] of renameByOldName.entries()) {
      const escaped = this.escapeForAttributeSelector(oldName);
      const candidates = Array.from(
        (root as ParentNode).querySelectorAll?.(
          `tbody [title="${escaped}"],tbody [aria-label="${escaped}"]`
        ) || []
      ) as HTMLElement[];
      for (const el of candidates) {
        if (el.closest('tbody') == null) continue;
        patched += this.patchNameElement(el, oldName, newName);
      }
    }

    // Fallback: patch plain text nodes (virtual scrolling / nested structures)
    const patchRoot = root instanceof Element ? root : document.body;
    patched += this.patchExactTextInElement(patchRoot, renameByOldName);

    return patched;
  }

  private observeAndPatchRenamedRows(
    renameInfoById: Map<string, { oldName?: string; newName: string }>,
    renameByOldName: Map<string, string>,
    timeoutMs: number
  ): void {
    try {
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of Array.from(mutation.addedNodes)) {
            if (!(node instanceof Element)) continue;
            this.patchElementTree(node, renameInfoById, renameByOldName);
          }
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      this.patchElementTree(document.body, renameInfoById, renameByOldName);

      window.setTimeout(() => observer.disconnect(), timeoutMs);
    } catch (error) {
      logger.debug('[BaiduAdapter] Failed to observe DOM for patching:', error instanceof Error ? error : new Error(String(error)));
    }
  }

  private patchElementTree(
    root: Element,
    renameInfoById: Map<string, { oldName?: string; newName: string }>,
    renameByOldName: Map<string, string>
  ): void {
    const idAttrSelectors = ['[data-fs-id]', '[data-id]'].join(',');

    const nodes: Element[] = [];
    if (root.matches(idAttrSelectors)) {
      nodes.push(root);
    }
    nodes.push(...Array.from(root.querySelectorAll(idAttrSelectors)));

    for (const node of nodes) {
      const fileId = node.getAttribute('data-fs-id') || node.getAttribute('data-id');
      if (!fileId) continue;

      const info = renameInfoById.get(fileId);
      if (!info) continue;

      const row = node.closest('tr,[role="row"]') || node;
      this.patchRowElement(row, info.oldName, info.newName);
    }

    if (renameByOldName.size > 0) {
      for (const [oldName, newName] of renameByOldName.entries()) {
        const escaped = this.escapeForAttributeSelector(oldName);
        const candidates = Array.from(
          root.querySelectorAll(`[title="${escaped}"],[aria-label="${escaped}"]`)
        ) as HTMLElement[];
        for (const el of candidates) {
          this.patchNameElement(el, oldName, newName);
        }
      }

      this.patchExactTextInElement(root, renameByOldName);
    }
  }

  private findRowByFileId(fileId: string): Element | null {
    return document.querySelector(`[data-fs-id="${fileId}"], [data-id="${fileId}"]`);
  }

  private patchRowElement(row: Element, oldName: string | undefined, newName: string): number {
    const nameSelector = '.wp-s-pan-list__file-name-title-text, .list-name-text, a[title]';
    const nameEls = Array.from(row.querySelectorAll(nameSelector)) as HTMLElement[];
    if (nameEls.length === 0) return 0;

    let patched = 0;
    for (const el of nameEls) {
      patched += this.patchNameElement(el, oldName, newName);
    }
    return patched;
  }

  private patchNameElement(el: HTMLElement, oldName: string | undefined, newName: string): number {
    let changed = false;

    if (oldName) {
      const title = el.getAttribute('title')?.trim();
      if (title === oldName) {
        el.setAttribute('title', newName);
        changed = true;
      }

      const aria = el.getAttribute('aria-label')?.trim();
      if (aria === oldName) {
        el.setAttribute('aria-label', newName);
        changed = true;
      }

      // Prefer updating text nodes without destroying nested structure.
      changed = this.patchExactTextNodes(el, oldName, newName) > 0 || changed;

      if (!changed && el.childElementCount === 0) {
        const text = (el.textContent || '').trim();
        if (text === oldName) {
          el.textContent = newName;
          changed = true;
        }
      }
    } else {
      if (el.childElementCount === 0) {
        el.textContent = newName;
        changed = true;
      }

      if (el.hasAttribute('title')) {
        el.setAttribute('title', newName);
        changed = true;
      }
      if (el.hasAttribute('aria-label')) {
        el.setAttribute('aria-label', newName);
        changed = true;
      }
    }

    return changed ? 1 : 0;
  }

  private patchExactTextNodes(root: Element, oldName: string, newName: string): number {
    let patched = 0;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const textNode = node as Text;
      const value = textNode.nodeValue;
      if (!value) continue;

      if (value === oldName) {
        textNode.nodeValue = newName;
        patched++;
        continue;
      }

      const trimmed = value.trim();
      if (trimmed === oldName) {
        textNode.nodeValue = value.replace(trimmed, newName);
        patched++;
      }
    }

    return patched;
  }

  private patchExactTextInElement(root: Element, renameByOldName: Map<string, string>): number {
    if (renameByOldName.size === 0) return 0;

    let patched = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null;

    while ((node = walker.nextNode())) {
      const textNode = node as Text;
      const value = textNode.nodeValue;
      if (!value) continue;

      const direct = renameByOldName.get(value);
      if (direct) {
        textNode.nodeValue = direct;
        patched++;
        continue;
      }

      const trimmed = value.trim();
      if (!trimmed) continue;
      const replacement = renameByOldName.get(trimmed);
      if (!replacement) continue;

      textNode.nodeValue = value.replace(trimmed, replacement);
      patched++;
    }

    return patched;
  }

  private escapeForAttributeSelector(value: string): string {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(value);
    }
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  /**
   * Poll task status until completion
   * @private
   */
  private async pollTaskStatus(
    taskid: number
  ): Promise<BaiduTaskResponse> {
    for (let attempt = 0; attempt < this.maxTaskPollAttempts; attempt++) {
      // Wait before polling
      await this.sleep(this.taskPollInterval);
      await this.rateLimit();

      try {
        // Note: /share/taskquery is at root level, not under /api
        const url = `https://pan.baidu.com/share/taskquery?taskid=${taskid}&clienttype=0&app_id=250528&web=1`;

        const injector = getPageScriptInjector();
        const result: BaiduTaskResponse = await injector.callAPI(
          'POST',
          url,
          {},
          this.config.timeout
        );

        // Check task status
        if (result.errno !== 0) {
          throw new BaiduAPIError(result.errno, getErrorMessage(result.errno), result);
        }

        // Terminal states
        if (result.status === 'success' || result.status === 'failed') {
          return result;
        }

        // Continue polling for 'running' or 'pending'
        logger.info(`Task ${taskid} status: ${result.status}, polling attempt ${attempt + 1}/${this.maxTaskPollAttempts}`);

      } catch (error) {
        logger.error(`Task polling error (attempt ${attempt + 1}):`, error instanceof Error ? error : new Error(String(error)));

        // Last attempt failed
        if (attempt === this.maxTaskPollAttempts - 1) {
          throw error;
        }
      }
    }

    // Timeout after max attempts
    throw new Error(`任务 ${taskid} 超时: 超过最大轮询次数 ${this.maxTaskPollAttempts}`);
  }

  /**
   * Rate limiting implementation
   * @private
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.config.requestInterval) {
      const delay = this.config.requestInterval - timeSinceLastRequest;
      await this.sleep(delay);
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Retryable request wrapper with exponential backoff
   * @private
   */
  private async retryableRequest<T extends RenameResult>(
    requestFn: () => Promise<T>,
    operation: string
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await requestFn();
        return result;
      } catch (error) {
        lastError = error;

        // Check if retryable
        if (!isRetryableError(error)) {
          logger.error(`${operation} 失败（不可重试）:`, error instanceof Error ? error : new Error(String(error)));
          break;
        }

        // Last attempt
        if (attempt === this.config.maxRetries) {
          logger.error(`${operation} 失败（已达最大重试次数 ${this.config.maxRetries}）:`, error instanceof Error ? error : new Error(String(error)));
          break;
        }

        // Exponential backoff
        const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        logger.warn(
          `${operation} 失败（第 ${attempt}/${this.config.maxRetries} 次尝试），` +
          `${backoffDelay}ms 后重试:`,
          error instanceof Error ? error : new Error(String(error))
        );
        await this.sleep(backoffDelay);
      }
    }

    // All retries failed
    return {
      success: false,
      error: lastError instanceof Error ? lastError : new Error(String(lastError)),
    } as T;
  }
}
