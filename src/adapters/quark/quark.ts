import { BasePlatformAdapter } from '../base/adapter.interface';
import {
  PlatformName,
  FileItem,
  RenameResult,
  PlatformConfig,
} from '../../types/platform';
import { parseFileName } from '../../utils/helpers';
import { QuarkAPIError, getErrorMessage, isRetryableError } from './errors';
import { getPageScriptInjector } from './page-script-injector';
import { logger } from '../../utils/logger';

/**
 * 夸克网盘 API 响应格式
 */
interface QuarkAPIResponse<T = any> {
  status: number;
  code: number;
  message: string;
  timestamp: number;
  data: T;
}

/**
 * 夸克文件列表数据
 */
interface QuarkFileData {
  fid: string;
  file_name: string;
  pdir_fid: string;
  category: number;
  file_type: number;
  size: number;
  format_type: string;
  status: number;
  created_at: number;
  updated_at: number;
  dir: boolean;
  file: boolean;
}

/**
 * 夸克网盘平台适配器
 * 基于 2025-12-10 的 API 探索结果实现
 *
 * API 文档参考:
 * - Base URL: https://drive-pc.quark.cn/1/clouddrive
 * - 认证方式: Cookie-based (document.cookie)
 * - 速率限制: 800ms 间隔
 */
export class QuarkAdapter extends BasePlatformAdapter {
  readonly platform: PlatformName = 'quark';

  private baseURL = 'https://drive-pc.quark.cn/1/clouddrive';
  private lastRequestTime = 0;

  constructor(config?: Partial<PlatformConfig>) {
    super({
      platform: 'quark',
      requestInterval: 800, // 夸克网盘推荐间隔
      maxRetries: 3,
      timeout: 30000,
      ...config,
    });
  }

  /**
   * 获取当前选中的文件列表
   * 从夸克网盘的 DOM 结构中提取选中文件信息
   */
  async getSelectedFiles(): Promise<FileItem[]> {
    try {
      // 查找所有选中的复选框
      const checkedItems = document.querySelectorAll('.ant-checkbox-checked');

      if (checkedItems.length === 0) {
        return [];
      }

      const files: FileItem[] = [];

      for (const checkbox of Array.from(checkedItems)) {
        // 找到包含文件信息的行
        const row = checkbox.closest('tr');
        if (!row) continue;

        // 提取文件信息
        const fileId = row.getAttribute('data-file-id') || '';
        const fileName = row.querySelector('.file-name')?.textContent?.trim() || '';
        const parentId = this.getCurrentFolderId();
        const sizeAttr = row.getAttribute('data-size');
        const mtimeAttr = row.getAttribute('data-mtime');

        // 过滤掉文件夹（只处理文件）
        const isDir = row.classList.contains('is-directory') ||
                      row.getAttribute('data-is-dir') === 'true';

        if (isDir) {
          continue;
        }

        const { ext } = parseFileName(fileName);

        files.push({
          id: fileId,
          name: fileName,
          ext: ext,
          parentId: parentId,
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
   * @param parentId Parent directory ID (optional, defaults to current directory)
   * @returns Complete file list
   */
  async getAllFiles(parentId?: string): Promise<FileItem[]> {
    try {
      logger.info('[QuarkAdapter] Fetching all files from API');

      const targetParentId = parentId || this.getCurrentFolderId();
      const allFiles: FileItem[] = [];
      let page = 1;
      const pageSize = 100;
      let hasMore = true;

      // Paginate through all files
      while (hasMore) {
        await this.rateLimit();

        const url = new URL(`${this.baseURL}/file/sort`);
        url.searchParams.set('pr', 'ucpro');
        url.searchParams.set('fr', 'pc');
        url.searchParams.set('pdir_fid', targetParentId);
        url.searchParams.set('_page', page.toString());
        url.searchParams.set('_size', pageSize.toString());
        url.searchParams.set('_fetch_total', '1');

        const response = await this.fetchWithTimeout(url.toString(), {
          method: 'GET',
          credentials: 'include',
        });

        const result: QuarkAPIResponse<{ list: QuarkFileData[] }> = await response.json();

        if (result.code !== 0 || !result.data?.list) {
          const errorMsg = getErrorMessage(result.code, result.message);
          throw new QuarkAPIError(result.code, errorMsg, result);
        }

        const pageFiles = result.data.list;

        // Include both files and folders (folders have empty extension)
        const files = pageFiles.map((item): FileItem => {
          const ext = item.file ? parseFileName(item.file_name).ext : '';
          return {
            id: item.fid,
            name: item.file_name,
            ext,
            parentId: item.pdir_fid,
            size: item.size,
            mtime: item.updated_at,
          };
        });

        allFiles.push(...files);

        // Check if there are more pages
        hasMore = pageFiles.length === pageSize;
        page++;

        logger.debug(`[QuarkAdapter] Fetched page ${page - 1} with ${files.length} files`);
      }

      logger.info(`[QuarkAdapter] Successfully fetched ${allFiles.length} files`);
      return allFiles;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to get all files:', errorObj);
      throw new Error(`获取文件列表失败: ${errorObj.message}`);
    }
  }

  /**
   * 重命名文件
   * 调用夸克网盘的重命名 API，支持自动重试
   *
   * @param fileId 文件唯一标识符 (fid)
   * @param newName 新文件名
   * @returns 重命名结果
   */
  async renameFile(fileId: string, newName: string): Promise<RenameResult> {
    return this.retryableRequest(async () => {
      // 执行速率限制
      await this.rateLimit();

      // 获取父目录 ID（可能是必需参数）
      const parentId = this.getCurrentFolderId();

      // 使用页面脚本注入器调用API（解决Cookie认证问题）
      const injector = getPageScriptInjector();
      const requestBody: any = {
        fid: fileId,
        file_name: newName,
      };

      // 添加可能需要的额外参数
      if (parentId && parentId !== '0') {
        requestBody.pdir_fid = parentId;
      }

      const result: QuarkAPIResponse = await injector.callAPI(
        'POST',
        `${this.baseURL}/file/rename`,
        requestBody,
        this.config.timeout
      );

      if (result.code === 0 && result.status === 200) {
        return {
          success: true,
          newName: newName,
        };
      } else {
        const errorMsg = getErrorMessage(result.code, result.message);
        throw new QuarkAPIError(result.code, errorMsg, result);
      }
    }, `重命名文件 ${fileId}`);
  }

  /**
   * 检查文件名是否存在冲突
   * 通过获取当前目录的文件列表来检查同名文件
   *
   * @param fileName 要检查的文件名
   * @param parentId 父目录 ID
   * @returns 是否存在同名文件
   */
  async checkNameConflict(fileName: string, parentId: string): Promise<boolean> {
    try {
      await this.rateLimit();

      const url = new URL(`${this.baseURL}/file/sort`);
      url.searchParams.set('pr', 'ucpro');
      url.searchParams.set('fr', 'pc');
      url.searchParams.set('pdir_fid', parentId);
      url.searchParams.set('_page', '1');
      url.searchParams.set('_size', '100');
      url.searchParams.set('_fetch_total', '1');

      const response = await this.fetchWithTimeout(url.toString(), {
        method: 'GET',
        credentials: 'include',
      });

      const result: QuarkAPIResponse<{ list: QuarkFileData[] }> = await response.json();

      if (result.code === 0 && result.data?.list) {
        // 检查是否存在同名文件
        return result.data.list.some(file => file.file_name === fileName);
      }

      return false;
    } catch (error) {
      logger.error('Failed to check name conflict:', error instanceof Error ? error : new Error(String(error)));
      // 出错时保守处理，返回可能存在冲突
      return true;
    }
  }

  /**
   * 获取文件详细信息
   * 用于幂等性检查和状态验证
   *
   * @param fileId 文件 ID
   * @returns 文件详细信息
   */
  async getFileInfo(fileId: string): Promise<FileItem> {
    try {
      await this.rateLimit();

      // 注意: 夸克 API 可能没有单独的文件详情接口
      // 这里需要通过文件列表 API 来查找特定文件
      // 或者从 DOM 中提取

      // 尝试从 DOM 中查找文件信息
      const row = document.querySelector(`tr[data-file-id="${fileId}"]`);

      if (!row) {
        throw new Error(`找不到文件 ID: ${fileId}`);
      }

      const fileName = row.querySelector('.file-name')?.textContent?.trim() || '';
      const parentId = this.getCurrentFolderId();
      const sizeAttr = row.getAttribute('data-size');
      const mtimeAttr = row.getAttribute('data-mtime');
      const { ext } = parseFileName(fileName);

      return {
        id: fileId,
        name: fileName,
        ext: ext,
        parentId: parentId,
        size: sizeAttr ? parseInt(sizeAttr, 10) : 0,
        mtime: mtimeAttr ? parseInt(mtimeAttr, 10) : Date.now(),
      };
    } catch (error) {
      logger.error(`Failed to get file info for ${fileId}:`, error instanceof Error ? error : new Error(String(error)));
      throw new Error(`获取文件信息失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 从当前页面 URL 或 DOM 中提取当前文件夹 ID
   * @private
   */
  private getCurrentFolderId(): string {
    // 尝试从 URL 中提取
    const urlParams = new URLSearchParams(window.location.search);
    const dirId = urlParams.get('dir_id') || urlParams.get('pdir_fid');

    if (dirId) {
      return dirId;
    }

    // 夸克网盘使用 hash 路由 (例如: #/list/folder/12345 或 #/list/all/12345-xxxx)
    // 支持嵌套路径: #/list/all/parent-name/child1-name/child2-name
    const hash = window.location.hash || '';
    if (hash) {
      // Remove query string portion in hash (if any)
      const hashPath = hash.split('?')[0];

      // 🔧 FIX: 提取整个路径，取最后一个 segment（当前目录）
      // 移除前缀 #/list/folder/ 或 #/list/all/
      const normalized = hashPath
        .replace(/^#/, '')
        .replace(/^\/list\/(?:all|folder)/, '')
        .replace(/^\/+/, '')
        .replace(/\/+$/, '');

      if (normalized) {
        // 分割路径，取最后一个 segment（当前目录）
        const segments = normalized.split('/').filter(Boolean);
        if (segments.length > 0) {
          const lastSegment = segments[segments.length - 1];
          // 提取 ID（-之前的部分）
          // 例如: "e1446ca1c77f4061b470c07961369e2d-第一章：机器学习与深度学习理论基础"
          //   -> "e1446ca1c77f4061b470c07961369e2d"
          const idMatch = lastSegment.match(/^([a-z0-9]+)/);
          if (idMatch && idMatch[1]) {
            return idMatch[1];
          }
        }
      }
    }

    // 尝试从 DOM 中提取
    const dirElement = document.querySelector('[data-dir-id]');
    if (dirElement) {
      const domDirId = dirElement.getAttribute('data-dir-id');
      if (domDirId) {
        return domDirId;
      }
    }

    // 默认返回根目录标识
    return '0';
  }

  /**
   * 速率限制
   * 确保请求间隔不小于配置的 requestInterval
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
   * 带重试机制的请求包装器
   * @param requestFn 请求函数
   * @param operation 操作描述（用于日志）
   * @returns 请求结果
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

        // 判断是否可以重试
        if (!isRetryableError(error)) {
          logger.error(`${operation} 失败（不可重试）:`, error instanceof Error ? error : new Error(String(error)));
          break;
        }

        // 最后一次尝试失败，不再重试
        if (attempt === this.config.maxRetries) {
          logger.error(`${operation} 失败（已达最大重试次数 ${this.config.maxRetries}）:`, error instanceof Error ? error : new Error(String(error)));
          break;
        }

        // 计算指数退避延迟
        const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        logger.warn(
          `${operation} 失败（第 ${attempt}/${this.config.maxRetries} 次尝试），` +
          `${backoffDelay}ms 后重试:`,
          error instanceof Error ? error : new Error(String(error))
        );
        await this.sleep(backoffDelay);
      }
    }

    // 所有重试都失败，返回失败结果
    return {
      success: false,
      error: lastError instanceof Error ? lastError : new Error(String(lastError)),
    } as T;
  }
}
