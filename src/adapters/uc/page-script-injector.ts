import { logger } from '../../utils/logger';

interface PageScriptReadyFlag {
  ready: boolean;
  timestamp: number;
}

declare global {
  interface Window {
    __UC_PAGE_SCRIPT_READY__?: PageScriptReadyFlag;
    __UC_PAGE_SCRIPT_LOADED__?: boolean;
  }
}

interface PageAPIRequest {
  type: 'UC_API_REQUEST';
  requestId: string;
  method: string;
  url: string;
  body?: unknown;
}

interface PageAPIResponse {
  type: 'UC_API_RESPONSE';
  requestId: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

export class UCPageScriptInjector {
  private static instance: UCPageScriptInjector | null = null;
  private isReady = false;
  private pendingRequests = new Map<
    string,
    {
      resolve: (data: unknown) => void;
      reject: (error: Error) => void;
      timeout: number;
    }
  >();

  private constructor() {
    this.setupMessageListener();
    this.waitForPageScriptReady();
  }

  static getInstance(): UCPageScriptInjector {
    if (!UCPageScriptInjector.instance) {
      UCPageScriptInjector.instance = new UCPageScriptInjector();
    }
    return UCPageScriptInjector.instance;
  }

  private waitForPageScriptReady(): void {
    const MAX_FLAG_AGE_MS = 60000;
    const now = Date.now();
    const domReadyFlag = document.body.dataset.ucPageScriptReady;
    const domTimestampStr = document.body.dataset.ucPageScriptTimestamp;
    const domTimestamp = domTimestampStr ? Number.parseInt(domTimestampStr, 10) : null;

    if (domReadyFlag === 'true' && domTimestamp) {
      const flagAge = now - domTimestamp;
      if (flagAge < MAX_FLAG_AGE_MS) {
        this.isReady = true;
        logger.debug(`UC page script already ready (DOM flag age: ${flagAge}ms)`);
        return;
      }
      delete document.body.dataset.ucPageScriptReady;
      delete document.body.dataset.ucPageScriptTimestamp;
    }

    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'UC_PAGE_SCRIPT_READY') {
        this.isReady = true;
        logger.debug('UC page script ready signal received');
        window.removeEventListener('message', handler);
      }
    };

    window.addEventListener('message', handler);
    window.setTimeout(() => {
      if (!this.isReady) {
        logger.debug('UC page script ready signal timeout, assuming ready');
        this.isReady = true;
        window.removeEventListener('message', handler);
      }
    }, 2000);
  }

  private setupMessageListener(): void {
    window.addEventListener('message', (event: MessageEvent) => {
      const message = event.data as PageAPIResponse;
      if (message.type !== 'UC_API_RESPONSE') return;

      const pending = this.pendingRequests.get(message.requestId);
      if (!pending) return;

      window.clearTimeout(pending.timeout);
      this.pendingRequests.delete(message.requestId);

      if (message.success) {
        pending.resolve(message.data);
      } else {
        pending.reject(new Error(message.error || 'Unknown error'));
      }
    });
  }

  async callAPI(method: string, url: string, body?: unknown, timeout = 30000): Promise<unknown> {
    if (!this.isReady) {
      await new Promise<void>((resolve) => {
        const checkReady = () => {
          if (this.isReady) resolve();
          else window.setTimeout(checkReady, 100);
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
        type: 'UC_API_REQUEST',
        requestId,
        method,
        url,
        body,
      };

      window.postMessage(request, '*');
    });
  }
}

export function getUCPageScriptInjector(): UCPageScriptInjector {
  return UCPageScriptInjector.getInstance();
}
