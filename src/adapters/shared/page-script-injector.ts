interface PageScriptReadyFlag {
  ready: boolean;
  timestamp: number;
}

interface InjectorOptions {
  requestType: string;
  responseType: string;
  readyFlagName: string;
  datasetReadyKey: string;
  datasetTimestampKey: string;
  logPrefix: string;
}

interface APIRequestMessage {
  type: string;
  requestId: string;
  method: string;
  url: string;
  body?: unknown;
  timeout?: number;
}

interface APIResponseMessage {
  type: string;
  requestId: string;
  success: boolean;
  data?: unknown;
  error?: string;
  status?: number;
}

export class CloudDrivePageScriptInjector {
  private ready = false;
  private readyPromise: Promise<void>;
  private resolveReady!: () => void;
  private rejectReady!: (error: Error) => void;

  constructor(private readonly options: InjectorOptions) {
    this.readyPromise = new Promise((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
    this.waitForPageScriptReady();
  }

  async callAPI(method: string, url: string, body?: unknown, timeout = 30000): Promise<unknown> {
    await this.ensureReady();

    const requestId = `${this.options.logPrefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const message: APIRequestMessage = {
      type: this.options.requestType,
      requestId,
      method,
      url,
      body,
      timeout,
    };

    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        window.removeEventListener('message', handleResponse);
        reject(new Error(`${this.options.logPrefix} API request timeout`));
      }, timeout);

      const handleResponse = (event: MessageEvent<APIResponseMessage>) => {
        if (event.source !== window) return;
        const response = event.data;
        if (!response || response.type !== this.options.responseType || response.requestId !== requestId) return;

        window.clearTimeout(timer);
        window.removeEventListener('message', handleResponse);
        if (response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response.error || `${this.options.logPrefix} API request failed with status ${response.status || 'unknown'}`));
        }
      };

      window.addEventListener('message', handleResponse);
      window.postMessage(message, '*');
    });
  }

  private waitForPageScriptReady(): void {
    const isReady = () => {
      const domReadyFlag = document.body?.dataset[this.options.datasetReadyKey];
      const windowFlag = (window as unknown as Window & Record<string, unknown>)[this.options.readyFlagName] as PageScriptReadyFlag | undefined;
      return domReadyFlag === 'true' || windowFlag?.ready === true;
    };

    if (isReady()) {
      this.ready = true;
      this.resolveReady();
      return;
    }

    const startTime = Date.now();
    const checkReady = () => {
      if (isReady()) {
        this.ready = true;
        this.resolveReady();
        return;
      }

      if (Date.now() - startTime > 2000) {
        this.rejectReady(new Error(`${this.options.logPrefix} page script not ready`));
        return;
      }

      window.setTimeout(checkReady, 50);
    };

    checkReady();
  }

  private async ensureReady(): Promise<void> {
    if (this.ready) return;
    await this.readyPromise;
  }
}
