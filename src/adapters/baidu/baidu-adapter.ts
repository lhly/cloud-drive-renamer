import { BasePlatformAdapter } from '../base/adapter.interface';
import { PlatformName, FileItem, RenameResult, PlatformConfig, PageSyncResult } from '../../types/platform';
import { parseFileName } from '../../utils/helpers';
import { BaiduAPIError, getErrorMessage, isRetryableError } from './errors';
import { getPageScriptInjector } from './page-script-injector';
import { logger } from '../../utils/logger';

/**
 * Baidu API Response Format
 */
interface BaiduAPIResponse<T = unknown> {
  errno: number;
  info?: unknown;
  taskid?: number | string;
  data?: T;
  // Some endpoints (e.g. /api/list) return `list` at top-level instead of inside `data`.
  list?: BaiduFileListItem[];
}

/**
 * Baidu Task Query Response
 */
interface BaiduTaskResponse extends BaiduAPIResponse {
  status: 'running' | 'pending' | 'success' | 'failed';
}

type TaskPollResult =
  | { status: 'success' | 'failed'; attempts: number; response: BaiduTaskResponse }
  | { status: 'unknown'; attempts: number; reason: 'poll-limit' | 'query-rejected' | 'query-error' | 'invalid-response'; response?: BaiduTaskResponse };

interface DirectoryListing {
  paths: Map<string, string>;
  pending?: {
    files: Promise<FileItem[]>;
    invalidatedIds: Set<string>;
  };
}

// Never log server text, item identifiers, or raw response objects.
function responseErrorCodes(response?: BaiduAPIResponse): { errno?: number; itemErrnos?: number[] } {
  const codes = Array.isArray(response?.info) ? response.info.flatMap((item: unknown) => {
    const code = item && typeof item === 'object' && 'errno' in item ? item.errno : undefined;
    return typeof code === 'number' && Number.isSafeInteger(code) ? [code] : [];
  }) : [];
  return {
    ...(Number.isSafeInteger(response?.errno) ? { errno: response?.errno } : {}),
    ...(codes.length ? { itemErrnos: [...new Set(codes)] } : {}),
  };
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
  private readonly listingsByDirectory = new Map<string, DirectoryListing>();

  constructor(config?: Partial<PlatformConfig>) {
    super({
      platform: 'baidu',
      requestInterval: 800,     // Baidu API rate limit
      maxRetries: 3,
      timeout: 30000,
      ...config,
    });
  }

  getCurrentDirectoryKey(): string {
    return this.getCurrentPath();
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
    const directory = parentPath || this.getCurrentPath();
    let listing = this.listingsByDirectory.get(directory);
    if (!listing) {
      listing = { paths: new Map() };
      this.listingsByDirectory.set(directory, listing);
    }
    if (listing.pending) return listing.pending.files;

    const paths = new Map<string, string>();
    const invalidatedIds = new Set<string>();
    // Share a read for fresh adapters and concurrent renames missing from the index.
    const files = this.fetchDirectoryFiles(directory, paths);
    listing.pending = { files, invalidatedIds };
    try {
      const result = await files;
      for (const fileId of invalidatedIds) paths.delete(fileId);
      listing.paths = paths;
      return result;
    } catch (error) {
      listing.paths.clear();
      throw error;
    } finally {
      listing.pending = undefined;
    }
  }

  private async fetchDirectoryFiles(targetPath: string, paths: Map<string, string>): Promise<FileItem[]> {
    try {
      logger.info('[BaiduAdapter] Fetching all files from API');

      const bdstoken = await this.extractBdstoken();

      if (!bdstoken) {
        throw new Error('无法获取 bdstoken，请确保已登录百度网盘');
      }

      const allFiles: FileItem[] = [];
      const directoryPrefix = targetPath.replace(/\/$/, '');
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

        let result: BaiduAPIResponse<{ list: BaiduFileListItem[] }>;
        try {
          const response = await this.fetchWithTimeout(url.toString(), {
            method: 'GET',
            credentials: 'include',
          });
          if (!response.ok) throw new Error();
          result = await response.json();
        } catch {
          throw new Error('无法读取百度网盘目录列表');
        }

        if (!Number.isSafeInteger(result?.errno)) throw new Error('无法解析文件列表响应');
        if (result.errno !== 0) {
          throw new BaiduAPIError(result.errno, getErrorMessage(result.errno));
        }

        const pageFiles = result.data?.list ?? result.list;
        if (!Array.isArray(pageFiles)) {
          throw new Error('无法解析文件列表响应');
        }

        // Filter out folders (only return files, isdir === 0)
        const files = pageFiles
          .filter(f => f.isdir === 0)
          .map((file): FileItem => {
            const { ext } = parseFileName(file.server_filename);
            const id = String(file.fs_id);
            const path = file.path;
            // Check that this is a complete path to an item in the listed directory.
            if (typeof path === 'string' && path.startsWith('/') && !path.endsWith('/')
              && path.slice(0, path.lastIndexOf('/')) === directoryPrefix) {
              paths.set(id, path);
            }
            return {
              id,
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
    const directory = this.getCurrentPath();
    const id = Number(fileId);
    const operationId = crypto.randomUUID();
    if (!Number.isSafeInteger(id) || id <= 0 || String(id) !== fileId) {
      return { success: false, error: new Error('无法识别文件，请重新加载列表后再试') };
    }

    return this.retryableRequest(async () => {
      const filePath = await this.resolveRenamePath(directory, fileId);
      if (!filePath) {
        logger.warn('[BaiduAdapter] Rename source path unavailable', { operationId, pathSource: 'unavailable' });
        return { success: false, error: new Error('无法确认文件路径，请重新加载当前目录后再试') };
      }
      const diagnostic = { operationId, pathSource: 'api/list' };

      // Apply rate limiting
      await this.rateLimit();

      // Get bdstoken from page (async via MAIN world)
      const bdstoken = await this.extractBdstoken();
      if (!bdstoken) {
        return { success: false, error: new Error('无法获取 bdstoken，请确保已登录百度网盘') };
      }

      if (directory !== this.getCurrentPath()) {
        return { success: false, error: new Error('目录已切换，请重新加载当前目录后再试') };
      }

      // Construct rename request
      const url = `${this.baseURL}/filemanager?async=2&onnest=fail&opera=rename&bdstoken=${bdstoken}&clienttype=0&app_id=250528&web=1`;

      const requestBody = {
        filelist: JSON.stringify([{
          id,                          // fs_id as number
          path: filePath,              // Full path from /api/list
          newname: newName              // Name only
        }])
      };

      // Use page script injector for cookie authentication
      const injector = getPageScriptInjector();
      let result: BaiduAPIResponse;
      try {
        result = await injector.callAPI('POST', url, requestBody, this.config.timeout);
      } catch {
        this.invalidateRenamePath(directory, fileId);
        logger.error('[BaiduAdapter] Rename submission outcome unknown', undefined, {
          ...diagnostic, reason: 'request-error',
        });
        return { success: false, error: new Error('重命名提交结果未知，请刷新列表确认文件名后再试') };
      }

      // Check immediate response
      if (Number.isSafeInteger(result?.errno) && result.errno !== 0) {
        logger.error('[BaiduAdapter] Rename submission rejected', undefined, {
          ...diagnostic, ...responseErrorCodes(result),
        });
        throw new BaiduAPIError(result.errno, getErrorMessage(result.errno));
      }

      // Extract taskid for async tracking
      const taskid = result?.taskid;
      const taskKey = typeof taskid === 'number' || typeof taskid === 'string' ? String(taskid) : '';
      if (result?.errno !== 0 || !/^[1-9]\d*$/.test(taskKey)) {
        this.invalidateRenamePath(directory, fileId);
        logger.error('[BaiduAdapter] Rename submission outcome unknown', undefined, {
          ...diagnostic, ...responseErrorCodes(result),
          reason: result?.errno === 0 ? 'missing-task-id' : 'invalid-response',
        });
        return { success: false, error: new Error('无法确认重命名任务，请刷新列表确认文件名后再试') };
      }

      logger.info('[BaiduAdapter] Rename task accepted', diagnostic);
      const taskResult = await this.pollTaskStatus(taskKey);
      this.invalidateRenamePath(directory, fileId);

      if (taskResult.status === 'success') {
        return { success: true, newName };
      }
      const taskDiagnostic = {
        ...diagnostic, ...responseErrorCodes(taskResult.response),
        status: taskResult.status, pollAttempts: taskResult.attempts,
      };
      if (taskResult.status === 'unknown') {
        logger.error('[BaiduAdapter] Rename task outcome unknown', undefined, {
          ...taskDiagnostic, reason: taskResult.reason,
        });
        return { success: false, error: new Error('重命名任务结果未知，请刷新列表确认文件名后再试') };
      }
      logger.error('[BaiduAdapter] Rename task failed', undefined, taskDiagnostic);
      return { success: false, error: new Error('任务执行失败: failed') };
    }, operationId);
  }

  private async resolveRenamePath(directory: string, fileId: string): Promise<string | undefined> {
    const listing = this.listingsByDirectory.get(directory);
    const path = listing?.paths.get(fileId);
    if (path && !listing?.pending) return path;
    try {
      await this.getAllFiles(directory);
      return this.listingsByDirectory.get(directory)?.paths.get(fileId);
    } catch {
      // getAllFiles already records the list failure; don't construct a path from the page.
      return undefined;
    }
  }

  private invalidateRenamePath(directory: string, fileId: string): void {
    const listing = this.listingsByDirectory.get(directory);
    listing?.paths.delete(fileId);
    // A list read started before completion may still contain the previous path.
    listing?.pending?.invalidatedIds.add(fileId);
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

      const list = result.data?.list ?? result.list;
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
   * Read current file info for recovery and idempotency checks.
   *
   * @param fileId - fs_id
   * @returns File information
   */
  async getFileInfo(fileId: string): Promise<FileItem> {
    const directory = this.getCurrentPath();
    const files = await this.getAllFiles(directory);
    const file = files.find(item => item.id === fileId);
    if (!file || directory !== this.getCurrentPath()) {
      throw new Error('无法确认文件信息，请重新加载当前目录后再试');
    }
    return file;
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
    const pathFromQuery = new URLSearchParams(window.location.search).get('path');
    if (pathFromQuery) return pathFromQuery;

    // Use the same query codec as the route refresh, which encodes spaces as "+".
    const hash = window.location.hash;
    const queryStart = hash.indexOf('?');
    return (queryStart >= 0 && new URLSearchParams(hash.slice(queryStart)).get('path')) || '/';
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
    taskid: string
  ): Promise<TaskPollResult> {
    let outcome: TaskPollResult = { status: 'unknown', reason: 'poll-limit', attempts: 0 };
    for (let attempt = 0; attempt < this.maxTaskPollAttempts; attempt++) {
      const attempts = attempt + 1;
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

        if (!Number.isSafeInteger(result?.errno)) {
          outcome = { status: 'unknown', reason: 'invalid-response', attempts };
        } else if (result.errno !== 0) {
          outcome = { status: 'unknown', reason: 'query-rejected', attempts, response: result };
        } else if (result.status === 'success' || result.status === 'failed') {
          return { status: result.status, attempts, response: result };
        } else {
          const reason = result.status === 'running' || result.status === 'pending' ? 'poll-limit' : 'invalid-response';
          outcome = { status: 'unknown', reason, attempts, response: result };
        }
      } catch {
        outcome = { status: 'unknown', reason: 'query-error', attempts };
      }
    }

    return outcome;
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
  private async retryableRequest(
    requestFn: () => Promise<RenameResult>,
    operationId: string
  ): Promise<RenameResult> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await requestFn();
        return result;
      } catch (error) {
        lastError = error instanceof BaiduAPIError ? error : new Error('无法提交百度网盘重命名请求');
        const diagnostic = {
          operationId, attempt,
          ...(error instanceof BaiduAPIError ? { errno: error.errno } : {}),
        };

        // Check if retryable
        if (!isRetryableError(error)) {
          logger.error('[BaiduAdapter] Rename request stopped', undefined, diagnostic);
          break;
        }

        // Last attempt
        if (attempt === this.config.maxRetries) {
          logger.error('[BaiduAdapter] Rename request retry limit reached', undefined, diagnostic);
          break;
        }

        // Exponential backoff
        const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        logger.warn('[BaiduAdapter] Retrying rejected rename request', { ...diagnostic, backoffDelay });
        await this.sleep(backoffDelay);
      }
    }

    // All retries failed
    return { success: false, error: lastError ?? new Error('无法提交百度网盘重命名请求') };
  }
}
