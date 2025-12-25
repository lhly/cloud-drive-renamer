/**
 * Page Script Injector for Aliyun Drive
 * Handles communication between ISOLATED world (content script) and MAIN world (page script)
 *
 * Similar to Quark/Baidu adapters but with Aliyun-specific token handling
 */

import { logger } from '../../utils/logger';

interface PageAPIRequest {
  type: 'ALIYUN_API_REQUEST';
  requestId: string;
  method: string;
  url: string;
  body?: any;
}

interface PageAPIResponse {
  type: 'ALIYUN_API_RESPONSE';
  requestId: string;
  success: boolean;
  data?: any;
  error?: string;
}

interface FileListInterceptedMessage {
  type: 'ALIYUN_FILE_LIST_INTERCEPTED';
  files: any[];
}

/**
 * Page Script Communication Class
 */
export class PageScriptInjector {
  private static instance: PageScriptInjector | null = null;
  private isReady = false;
  private pendingRequests = new Map<
    string,
    {
      resolve: (data: any) => void;
      reject: (error: Error) => void;
      timeout: number;
    }
  >();
  private fileListCallbacks: Array<(files: any[]) => void> = [];

  private constructor() {
    this.setupMessageListener();
    this.waitForPageScriptReady();
  }

  static getInstance(): PageScriptInjector {
    if (!PageScriptInjector.instance) {
      PageScriptInjector.instance = new PageScriptInjector();
    }
    return PageScriptInjector.instance;
  }

  /**
   * Wait for page script to be ready
   * Uses DOM-based communication (document.body.dataset) to handle world isolation
   */
  private waitForPageScriptReady(): void {
    const MAX_FLAG_AGE_MS = 60000; // 1 minute staleness detection

    const now = Date.now();
    const domReadyFlag = document.body.dataset.aliyunPageScriptReady;
    const domTimestampStr = document.body.dataset.aliyunPageScriptTimestamp;
    const domTimestamp = domTimestampStr ? parseInt(domTimestampStr, 10) : null;

    // Check persistent flag for late-loading content scripts
    if (domReadyFlag === 'true' && domTimestamp) {
      const flagAge = now - domTimestamp;

      if (flagAge < MAX_FLAG_AGE_MS) {
        this.isReady = true;
        logger.debug(`Aliyun page script already ready (flag age: ${flagAge}ms)`);
        return;
      } else {
        logger.warn(`Stale DOM flag detected (age: ${flagAge}ms), waiting for fresh signal`);
        delete document.body.dataset.aliyunPageScriptReady;
        delete document.body.dataset.aliyunPageScriptTimestamp;
      }
    }

    // Setup event listener for fresh signal
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'ALIYUN_PAGE_SCRIPT_READY') {
        this.isReady = true;
        logger.debug('Aliyun page script ready signal received');
        window.removeEventListener('message', handler);
      }
    };

    window.addEventListener('message', handler);

    // Timeout fallback
    setTimeout(() => {
      if (!this.isReady) {
        logger.debug('Aliyun page script ready signal timeout, assuming ready');
        this.isReady = true;
        window.removeEventListener('message', handler);
      }
    }, 2000);
  }

  /**
   * Setup message listener for API responses and file list interception
   */
  private setupMessageListener(): void {
    window.addEventListener('message', (event: MessageEvent) => {
      const message = event.data;

      // Handle API responses
      if (message.type === 'ALIYUN_API_RESPONSE') {
        const apiResponse = message as PageAPIResponse;
        const pending = this.pendingRequests.get(apiResponse.requestId);
        if (!pending) return;

        clearTimeout(pending.timeout);
        this.pendingRequests.delete(apiResponse.requestId);

        if (apiResponse.success) {
          pending.resolve(apiResponse.data);
        } else {
          pending.reject(new Error(apiResponse.error || 'Unknown error'));
        }
        return;
      }

      // Handle file list interception
      if (message.type === 'ALIYUN_FILE_LIST_INTERCEPTED') {
        const fileListMessage = message as FileListInterceptedMessage;

        logger.debug(`Received intercepted file list: ${fileListMessage.files.length} files`);

        // Notify all registered callbacks
        this.fileListCallbacks.forEach((callback) => {
          try {
            callback(fileListMessage.files);
          } catch (error) {
            logger.error('File list callback error:', error instanceof Error ? error : new Error(String(error)));
          }
        });
      }
    });
  }

  /**
   * Register callback for intercepted file lists
   * @param callback - Function to call when file list is intercepted
   */
  onFileListIntercepted(callback: (files: any[]) => void): void {
    this.fileListCallbacks.push(callback);
  }

  /**
   * Call Aliyun API via page script
   *
   * @param method - HTTP method
   * @param url - API URL
   * @param body - Request body
   * @param timeout - Timeout in milliseconds
   */
  async callAPI(
    method: string,
    url: string,
    body?: any,
    timeout = 30000
  ): Promise<any> {
    // Wait for page script ready
    if (!this.isReady) {
      await new Promise<void>((resolve) => {
        const checkReady = () => {
          if (this.isReady) {
            resolve();
          } else {
            setTimeout(checkReady, 100);
          }
        };
        checkReady();
      });
    }

    const requestId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

    return new Promise((resolve, reject) => {
      const timeoutHandle = window.setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`API request timeout: ${url}`));
      }, timeout);

      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeout: timeoutHandle,
      });

      const request: PageAPIRequest = {
        type: 'ALIYUN_API_REQUEST',
        requestId,
        method,
        url,
        body,
      };

      window.postMessage(request, '*');
    });
  }
}

export function getPageScriptInjector(): PageScriptInjector {
  return PageScriptInjector.getInstance();
}
