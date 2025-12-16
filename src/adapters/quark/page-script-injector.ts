/**
 * 页面脚本注入器
 * 负责与 MAIN world 的 page-script.ts 通信
 *
 * 注意：page-script.ts 通过 manifest.json 中的 world: "MAIN" 自动加载
 * 不再需要手动注入脚本
 */

import { logger } from '../../utils/logger';

/**
 * Type-safe flag structure for page script readiness
 * Includes timestamp for staleness detection
 */
interface PageScriptReadyFlag {
  ready: boolean;
  timestamp: number;
}

/**
 * Extend Window interface to include page script flags
 * This ensures type safety when accessing window properties
 */
declare global {
  interface Window {
    /**
     * Persistent flag set by page-script.ts in MAIN world
     * Used to detect if page script is already ready (handles race conditions)
     * Includes timestamp for staleness detection after navigation
     */
    __QUARK_PAGE_SCRIPT_READY__?: PageScriptReadyFlag;

    /**
     * Legacy flag for backward compatibility
     */
    __QUARK_PAGE_SCRIPT_LOADED__?: boolean;
  }
}

interface PageAPIRequest {
  type: 'QUARK_API_REQUEST';
  requestId: string;
  method: string;
  url: string;
  body?: any;
}

interface PageAPIResponse {
  type: 'QUARK_API_RESPONSE';
  requestId: string;
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * 页面脚本通信类
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

  /**
   * 获取单例实例
   */
  static getInstance(): PageScriptInjector {
    if (!PageScriptInjector.instance) {
      PageScriptInjector.instance = new PageScriptInjector();
    }
    return PageScriptInjector.instance;
  }

  /**
   * Waits for the page script (MAIN world) to be ready.
   *
   * **Solution to Chrome World Isolation:**
   * Uses DOM-based communication (document.body.dataset) instead of window properties.
   * Chrome's world isolation prevents ISOLATED world from accessing window properties
   * set by MAIN world, but both worlds can access the same DOM.
   *
   * Handles race condition where PageScriptInjector may be instantiated AFTER
   * the page script has already sent its ready signal (e.g., when navigating
   * between pages in a SPA, or when content script loads late).
   *
   * Uses DOM dataset with timestamp-based staleness detection to prevent
   * false positives from stale flags after browser back/forward navigation.
   *
   * @see document.body.dataset.quarkPageScriptReady - DOM-based flag set by page-script.ts
   * @see document.body.dataset.quarkPageScriptTimestamp - Timestamp for staleness detection
   */
  private waitForPageScriptReady(): void {
    const MAX_FLAG_AGE_MS = 60000; // 1 minute - prevents stale flags from previous page loads

    const now = Date.now();

    // Read from DOM dataset (works across world isolation)
    const domReadyFlag = document.body.dataset.quarkPageScriptReady;
    const domTimestampStr = document.body.dataset.quarkPageScriptTimestamp;
    const domTimestamp = domTimestampStr ? parseInt(domTimestampStr, 10) : null;

    // Check DOM-based persistent flag first (for late-loading content scripts)
    if (domReadyFlag === 'true' && domTimestamp) {
      const flagAge = now - domTimestamp;

      if (flagAge < MAX_FLAG_AGE_MS) {
        // Valid flag - page script is ready
        this.isReady = true;
        logger.debug(`Page script already ready (DOM flag age: ${flagAge}ms)`);
        return;
      } else {
        // Stale flag detected - clear it and wait for fresh signal
        logger.warn(
          `Stale DOM flag detected (age: ${flagAge}ms), waiting for fresh signal`
        );
        delete document.body.dataset.quarkPageScriptReady;
        delete document.body.dataset.quarkPageScriptTimestamp;
      }
    }

    // Flag not present or stale - set up event listener for fresh signal
    logger.debug('Setting up event listener for page script ready signal');

    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'QUARK_PAGE_SCRIPT_READY') {
        this.isReady = true;
        logger.debug('Page script ready signal received');
        window.removeEventListener('message', handler);
      }
    };

    window.addEventListener('message', handler);

    // Timeout detection - fallback if signal is missed
    setTimeout(() => {
      if (!this.isReady) {
        logger.debug('Page script ready signal timeout, assuming ready');
        this.isReady = true;
        window.removeEventListener('message', handler);
      }
    }, 2000);
  }

  /**
   * 设置消息监听器
   */
  private setupMessageListener(): void {
    window.addEventListener('message', (event: MessageEvent) => {
      const message = event.data as PageAPIResponse;

      // 跨 isolated worlds 通信：只检查消息类型
      if (message.type !== 'QUARK_API_RESPONSE') return;

      // 查找对应的pending请求
      const pending = this.pendingRequests.get(message.requestId);
      if (!pending) {
        return;
      }

      // 清理超时和请求记录
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(message.requestId);

      // 处理响应
      if (message.success) {
        pending.resolve(message.data);
      } else {
        pending.reject(new Error(message.error || 'Unknown error'));
      }
    });
  }

  /**
   * 通过页面脚本调用API
   * @param method HTTP方法
   * @param url API URL
   * @param body 请求体
   * @param timeout 超时时间（毫秒）
   */
  async callAPI(
    method: string,
    url: string,
    body?: any,
    timeout = 30000
  ): Promise<any> {
    // 等待页面脚本就绪
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

    // 生成唯一请求ID
    const requestId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

    // 创建Promise用于等待响应
    return new Promise((resolve, reject) => {
      // 设置超时
      const timeoutHandle = window.setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`API request timeout: ${url}`));
      }, timeout);

      // 记录pending请求
      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeout: timeoutHandle,
      });

      // 发送请求到页面脚本
      const request: PageAPIRequest = {
        type: 'QUARK_API_REQUEST',
        requestId,
        method,
        url,
        body,
      };

      window.postMessage(request, '*');
    });
  }
}

/**
 * 获取页面脚本注入器实例
 */
export function getPageScriptInjector(): PageScriptInjector {
  return PageScriptInjector.getInstance();
}
