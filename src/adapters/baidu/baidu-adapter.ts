import { BasePlatformAdapter } from '../base/adapter.interface';
import { PlatformName, FileItem, RenameResult, PlatformConfig } from '../../types/platform';
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

      if (result.errno === 0 && result.data?.list) {
        return result.data.list.some(file => file.server_filename === fileName);
      }

      return false;
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
