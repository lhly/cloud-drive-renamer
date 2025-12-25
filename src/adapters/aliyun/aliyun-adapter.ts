import { BasePlatformAdapter } from '../base/adapter.interface';
import { PlatformName, FileItem, RenameResult, PlatformConfig } from '../../types/platform';
import { parseFileName } from '../../utils/helpers';
import { AliyunAPIError, getErrorMessage, isRetryableError } from './errors';
import { getPageScriptInjector } from './page-script-injector';
import { logger } from '../../utils/logger';

/**
 * Aliyun Drive API Response Format
 * Based on verified API exploration (2025-12-23)
 */
interface AliyunAPIResponse {
  code?: string;           // Error code (e.g., "NotFound.File")
  message?: string;        // Error message
  [key: string]: any;      // Success response varies by endpoint
}

/**
 * Aliyun File Item from API
 */
interface AliyunFileItem {
  drive_id: string;        // Drive ID (fixed per account)
  file_id: string;         // File unique ID
  name: string;            // Filename
  type: 'file' | 'folder'; // Type
  size: number;            // File size in bytes
  updated_at: string;      // ISO 8601 timestamp
  parent_file_id: string;  // Parent folder ID
  sync_device_flag?: boolean; // Sync device flag (filter out sync files)
}

/**
 * User info response
 */
interface UserInfoResponse {
  resource_drive_id: string;
  backup_drive_id: string;
  [key: string]: any;
}

/**
 * Aliyun Drive Platform Adapter - API Direct Call Architecture
 *
 * Based on successful userscript implementation:
 * - Completely removes React Fiber extraction
 * - Completely removes CSS selector generation
 * - Uses Aliyun Drive API directly for all operations
 *
 * Architecture:
 * 1. Token: Retrieved from localStorage.token
 * 2. DriveId: Fetched via /v2/user/get API
 * 3. ParentId: Extracted from URL pathname
 * 4. File List: Fetched via /adrive/v3/file/list API
 * 5. Rename: Executed via /v3/file/update API
 *
 * Rate Limit: 800ms interval (conservative)
 */
export class AliyunAdapter extends BasePlatformAdapter {
  readonly platform: PlatformName = 'aliyun';

  private baseURL = 'https://api.aliyundrive.com';
  private userBaseURL = 'https://user.aliyundrive.com';
  private lastRequestTime = 0;

  // Cache for drive_id (persistent during session)
  private driveIdCache: string | null = null;

  constructor(config?: Partial<PlatformConfig>) {
    super({
      platform: 'aliyun',
      requestInterval: 800,     // Conservative rate limit
      maxRetries: 3,
      timeout: 30000,
      ...config,
    });

    logger.info('[AliyunAdapter] Initialized with API direct call architecture');
  }

  /**
   * Get drive_id from user API
   * Matches userscript implementation: getDriveId()
   * @private
   */
  private async getDriveId(): Promise<string> {
    // Return cached value if available
    if (this.driveIdCache) {
      return this.driveIdCache;
    }

    await this.rateLimit();

    const injector = getPageScriptInjector();

    try {
      const result: UserInfoResponse = await injector.callAPI(
        'POST',
        `${this.userBaseURL}/v2/user/get`,
        {},
        this.config.timeout
      );

      // Determine drive_id based on current path
      // /drive/file/all/backup -> backup_drive_id
      // otherwise -> resource_drive_id
      const driveId = location.pathname.startsWith('/drive/file/all/backup')
        ? result.backup_drive_id
        : result.resource_drive_id;

      // Cache for subsequent calls
      this.driveIdCache = driveId;

      logger.info(`[AliyunAdapter] DriveId fetched and cached: ${driveId}`);
      return driveId;
    } catch (error) {
      logger.error('Failed to fetch drive_id:', error instanceof Error ? error : new Error(String(error)));
      throw new Error(`获取 drive_id 失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extract parent_file_id from URL pathname
   * Matches userscript implementation: getParentId()
   * @private
   */
  private getParentIdFromUrl(): string {
    const path = location.pathname;
    const i = path.lastIndexOf('/');
    const lastSegment = path.slice(i + 1);

    // Check if last segment is a valid file_id (32+ alphanumeric characters)
    return /[a-z0-9]{32,}/.test(lastSegment) ? lastSegment : 'root';
  }

  /**
   * Get currently selected files from Aliyun Drive
   *
   * Strategy (API Direct Call):
   * 1. Get parent_file_id from URL
   * 2. Get drive_id from user API
   * 3. Fetch complete file list via /adrive/v3/file/list API (with pagination)
   * 4. Match selected files by extracting filenames from DOM
   * 5. Return matched files with real file_id
   *
   * Matches userscript implementation: getFileListOfCurrentDir()
   */
  async getSelectedFiles(): Promise<FileItem[]> {
    try {
      // Step 1: Extract selected filenames from DOM (simple text extraction)
      const selectedFilenames = this.extractSelectedFilenamesFromDOM();

      if (selectedFilenames.length === 0) {
        return [];
      }

      logger.info(`[AliyunAdapter] Found ${selectedFilenames.length} selected files in DOM`);

      // Step 2: Get parent_file_id and drive_id
      const parentId = this.getParentIdFromUrl();
      const driveId = await this.getDriveId();

      // Step 3: Fetch complete file list from API
      const allFiles = await this.fetchFileListFromAPI(parentId, driveId);

      // Step 4: Match selected files by name
      const selectedFiles: FileItem[] = [];

      for (const filename of selectedFilenames) {
        const matchedFile = allFiles.find(f => f.name === filename);

        if (!matchedFile) {
          logger.warn(`File not found in API response: ${filename}`);
          continue;
        }

        // Support both files and folders
        // Folders have empty extension
        const ext = matchedFile.type === 'folder'
          ? ''
          : parseFileName(filename).ext;

        selectedFiles.push({
          id: matchedFile.file_id,
          name: matchedFile.name,
          ext: ext,
          parentId: matchedFile.parent_file_id,
          size: matchedFile.size,
          mtime: new Date(matchedFile.updated_at).getTime(),
        });
      }

      logger.info(`[AliyunAdapter] Matched ${selectedFiles.length} files with API data`);
      return selectedFiles;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to get selected files:', errorObj);
      throw new Error(`获取选中文件失败: ${errorObj.message}`);
    }
  }

  /**
   * Extract selected filenames from DOM (simple, reliable approach)
   * Uses data-is-selected attribute to find selected rows
   * @private
   */
  private extractSelectedFilenamesFromDOM(): string[] {
    const selectedRows = document.querySelectorAll('[data-is-selected="true"]');
    const filenames: string[] = [];

    for (const row of Array.from(selectedRows)) {
      // Extract filename from title attribute (most reliable)
      const titleElements = row.querySelectorAll('[title]');
      let filename = '';

      for (const el of Array.from(titleElements)) {
        const title = (el as HTMLElement).getAttribute('title')?.trim();

        // Filter out UI labels
        if (title && title.length > 3 && !title.match(/^(选择|操作|更多|下载|分享|删除)$/)) {
          filename = title;
          break;
        }
      }

      if (filename) {
        filenames.push(filename);
      }
    }

    return filenames;
  }

  /**
   * Fetch file list from API for current directory
   * Matches userscript implementation: getFileListOfCurrentDir()
   * @private
   */
  private async fetchFileListFromAPI(parentFileId: string, driveId: string): Promise<AliyunFileItem[]> {
    await this.rateLimit();

    const injector = getPageScriptInjector();
    const result: AliyunFileItem[] = [];
    let marker: string | null = ''; // Empty string for initial request

    // Paginate through all files
    while (marker !== null) {
      try {
        const requestBody = {
          all: true,
          limit: 100,
          drive_id: driveId,
          parent_file_id: parentFileId,
          marker: marker,
          order_by: 'name',
          order_direction: 'ASC',
        };

        interface FileListResponse {
          items: AliyunFileItem[];
          next_marker: string;
        }

        const response: FileListResponse = await injector.callAPI(
          'POST',
          `${this.baseURL}/adrive/v3/file/list`,
          requestBody,
          this.config.timeout
        );

        result.push(...response.items);

        // next_marker is empty string when no more pages
        marker = response.next_marker || null;

        if (marker) {
          logger.debug(`[AliyunAdapter] Fetching next page with marker: ${marker.substring(0, 10)}...`);
        }
      } catch (error) {
        logger.error('Failed to fetch file list page:', error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    }

    // Filter out sync files (matches userscript)
    const filteredResult = result.filter(x => !x.sync_device_flag);

    logger.info(`[AliyunAdapter] Fetched ${filteredResult.length} files from API (filtered ${result.length - filteredResult.length} sync files)`);
    return filteredResult;
  }

  /**
   * Rename a file via Aliyun API
   *
   * Strategy (API Direct Call):
   * 1. fileId is already the real file_id from getSelectedFiles()
   * 2. Get drive_id from cache or API
   * 3. Call /v3/file/update API with check_name_mode: "refuse"
   *
   * Matches userscript implementation: rename()
   *
   * @param fileId - Real file_id from API
   * @param newName - New filename
   * @returns Rename result
   */
  async renameFile(fileId: string, newName: string): Promise<RenameResult> {
    return this.retryableRequest(async () => {
      await this.rateLimit();

      const driveId = await this.getDriveId();
      const injector = getPageScriptInjector();

      const requestBody = {
        drive_id: driveId,
        file_id: fileId,
        name: newName,
        check_name_mode: 'refuse'  // Reject if name conflict exists
      };

      logger.info(`[AliyunAdapter] Renaming file: ${fileId} -> ${newName}`);

      const result: AliyunAPIResponse = await injector.callAPI(
        'POST',
        `${this.baseURL}/v3/file/update`,
        requestBody,
        this.config.timeout
      );

      // Check for error response
      if (result.code) {
        const errorMsg = getErrorMessage(result.code, result.message);
        throw new AliyunAPIError(result.code, errorMsg, result);
      }

      // Success - API returns updated file object
      logger.info(`[AliyunAdapter] Rename successful: ${newName}`);
      return {
        success: true,
        newName: newName,
      };
    }, `重命名文件 ${fileId}`);
  }

  /**
   * Check if filename conflicts with existing files
   *
   * Strategy: Fetch file list from API and check for duplicates
   *
   * @param fileName - Filename to check
   * @param parentId - Parent folder file_id
   * @returns True if conflict exists
   */
  async checkNameConflict(fileName: string, parentId: string): Promise<boolean> {
    try {
      await this.rateLimit();

      const driveId = await this.getDriveId();
      const allFiles = await this.fetchFileListFromAPI(parentId, driveId);

      return allFiles.some(file => file.name === fileName);
    } catch (error) {
      logger.error('Failed to check name conflict:', error instanceof Error ? error : new Error(String(error)));
      return true; // Conservative on error
    }
  }

  /**
   * Get file information by file_id
   *
   * @param fileId - file_id
   * @returns File information
   */
  async getFileInfo(fileId: string): Promise<FileItem> {
    try {
      await this.rateLimit();

      const driveId = await this.getDriveId();
      const injector = getPageScriptInjector();

      const result: AliyunFileItem = await injector.callAPI(
        'POST',
        `${this.baseURL}/v2/file/get`,
        {
          drive_id: driveId,
          file_id: fileId
        },
        this.config.timeout
      );

      const { ext } = parseFileName(result.name);
      return {
        id: result.file_id,
        name: result.name,
        ext: ext,
        parentId: result.parent_file_id,
        size: result.size,
        mtime: new Date(result.updated_at).getTime(),
      };
    } catch (error) {
      logger.error(`Failed to get file info for ${fileId}:`, error instanceof Error ? error : new Error(String(error)));
      throw new Error(`获取文件信息失败: ${error instanceof Error ? error.message : String(error)}`);
    }
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

        if (!isRetryableError(error)) {
          logger.error(`${operation} 失败（不可重试）:`, error instanceof Error ? error : new Error(String(error)));
          break;
        }

        if (attempt === this.config.maxRetries) {
          logger.error(`${operation} 失败（已达最大重试次数 ${this.config.maxRetries}）:`, error instanceof Error ? error : new Error(String(error)));
          break;
        }

        const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        logger.warn(
          `${operation} 失败（第 ${attempt}/${this.config.maxRetries} 次尝试），` +
          `${backoffDelay}ms 后重试:`,
          error instanceof Error ? error : new Error(String(error))
        );
        await this.sleep(backoffDelay);
      }
    }

    return {
      success: false,
      error: lastError instanceof Error ? lastError : new Error(String(lastError)),
    } as T;
  }
}
