/**
 * Page Script Injector for Baidu Drive
 * Communicates with MAIN world page-script.ts
 */

import { logger } from '../../utils/logger';

interface PageScriptReadyFlag {
  ready: boolean;
  timestamp: number;
}

declare global {
  interface Window {
    __BAIDU_PAGE_SCRIPT_READY__?: PageScriptReadyFlag;
    __BAIDU_PAGE_SCRIPT_LOADED__?: boolean;
  }
}

interface PageAPIRequest {
  type: 'BAIDU_API_REQUEST';
  requestId: string;
  method: string;
  url: string;
  body?: any;
}

interface PageAPIResponse {
  type: 'BAIDU_API_RESPONSE';
  requestId: string;
  success: boolean;
  data?: any;
  error?: string;
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
   * Wait for page script to be ready (cross-world communication via DOM)
   */
  private waitForPageScriptReady(): void {
    const MAX_FLAG_AGE_MS = 60000;
    const now = Date.now();

    // Check DOM-based flag (works across world isolation)
    const domReadyFlag = document.body.dataset.baiduPageScriptReady;
    const domTimestampStr = document.body.dataset.baiduPageScriptTimestamp;
    const domTimestamp = domTimestampStr ? parseInt(domTimestampStr, 10) : null;

    if (domReadyFlag === 'true' && domTimestamp) {
      const flagAge = now - domTimestamp;

      if (flagAge < MAX_FLAG_AGE_MS) {
        this.isReady = true;
        return;
      } else {
        // Stale flag - wait for fresh signal
        delete document.body.dataset.baiduPageScriptReady;
        delete document.body.dataset.baiduPageScriptTimestamp;
      }
    }

    // Set up event listener for fresh signal
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'BAIDU_PAGE_SCRIPT_READY') {
        this.isReady = true;
        window.removeEventListener('message', handler);
      }
    };

    window.addEventListener('message', handler);

    // Timeout fallback
    setTimeout(() => {
      if (!this.isReady) {
        this.isReady = true;
        window.removeEventListener('message', handler);
      }
    }, 2000);
  }

  /**
   * Setup message listener for API responses
   */
  private setupMessageListener(): void {
    window.addEventListener('message', (event: MessageEvent) => {
      const message = event.data as PageAPIResponse;

      if (message.type !== 'BAIDU_API_RESPONSE') return;

      const pending = this.pendingRequests.get(message.requestId);
      if (!pending) {
        return;
      }

      clearTimeout(pending.timeout);
      this.pendingRequests.delete(message.requestId);

      if (message.success) {
        pending.resolve(message.data);
      } else {
        const errorObj = new Error(message.error || 'Unknown error');
        logger.error(`API response failed - requestId: ${message.requestId}`, errorObj);
        pending.reject(errorObj);
      }
    });
  }

  /**
   * Call Baidu API through page script
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

    // Generate unique request ID
    const requestId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

    return new Promise((resolve, reject) => {
      const timeoutHandle = window.setTimeout(() => {
        this.pendingRequests.delete(requestId);
        const timeoutError = new Error(`API request timeout: ${url}`);
        logger.error(`API request timeout - requestId: ${requestId}`, timeoutError);
        reject(timeoutError);
      }, timeout);

      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeout: timeoutHandle,
      });

      const request: PageAPIRequest = {
        type: 'BAIDU_API_REQUEST',
        requestId,
        method,
        url,
        body,
      };

      window.postMessage(request, '*');
    });
  }

  /**
   * Get bdstoken from MAIN world through page script
   * @returns bdstoken string or null if not found
   */
  async getBdstoken(timeout = 5000): Promise<string | null> {
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

    // Generate unique request ID
    const requestId = `bdstoken-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

    return new Promise<string | null>((resolve, reject) => {
      // Setup message listener for BDSTOKEN_RESPONSE
      const responseListener = (event: MessageEvent) => {
        const message = event.data;

        if (message.type !== 'BDSTOKEN_RESPONSE') return;
        if (message.requestId !== requestId) return;

        window.removeEventListener('message', responseListener);
        clearTimeout(timeoutHandle);

        if (message.success && message.bdstoken) {
          resolve(message.bdstoken);
        } else {
          logger.error('bdstoken not found in response');
          resolve(null);  // Resolve with null instead of rejecting
        }
      };

      window.addEventListener('message', responseListener);

      // Setup timeout
      const timeoutHandle = setTimeout(() => {
        window.removeEventListener('message', responseListener);
        logger.error(`getBdstoken timeout after ${timeout}ms`);
        reject(new Error(`getBdstoken timeout after ${timeout}ms`));
      }, timeout);

      // Send GET_BDSTOKEN request
      const request = {
        type: 'GET_BDSTOKEN',
        requestId,
      };

      window.postMessage(request, '*');
    });
  }
}

export function getPageScriptInjector(): PageScriptInjector {
  return PageScriptInjector.getInstance();
}
