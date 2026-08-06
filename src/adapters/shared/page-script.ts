export interface PageScriptInstallOptions {
  requestType: string;
  responseType: string;
  readyFlagName: string;
  datasetReadyKey: string;
  datasetTimestampKey: string;
  logPrefix: string;
  captureHeaders?: string[];
}

interface APIRequestMessage {
  type: string;
  requestId: string;
  method: string;
  url: string;
  body?: unknown;
  timeout?: number;
}

interface EncodedBody {
  bodyMode?: 'json' | 'form-data' | 'urlencoded' | 'headers';
  data?: unknown;
  entries?: Array<[string, string]>;
  headers?: Record<string, string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isEncodedBody(value: unknown): value is EncodedBody {
  return isRecord(value) && typeof value.bodyMode === 'string';
}

function normalizeHeaderName(name: string): string {
  return name.toLowerCase();
}

function appendHeaders(target: Headers, headers: Record<string, string> | undefined): void {
  if (!headers) return;
  for (const [key, value] of Object.entries(headers)) {
    if (value) target.set(key, value);
  }
}

function createBodyAndHeaders(body: unknown): { body?: BodyInit; headers?: Record<string, string> } {
  if (body === undefined || body === null) return {};

  if (isEncodedBody(body)) {
    if (body.bodyMode === 'form-data') {
      const form = new FormData();
      for (const [key, value] of body.entries || []) form.set(key, value);
      return { body: form, headers: body.headers };
    }

    if (body.bodyMode === 'urlencoded') {
      const params = new URLSearchParams();
      for (const [key, value] of body.entries || []) params.set(key, value);
      return {
        body: params.toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...body.headers,
        },
      };
    }

    if (body.bodyMode === 'headers') {
      return {
        headers: {
          ...body.headers,
        },
      };
    }

    return {
      body: JSON.stringify(body.data ?? {}),
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        ...body.headers,
      },
    };
  }

  return {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json;charset=UTF-8' },
  };
}

export function markPageScriptReady(options: PageScriptInstallOptions, timestamp: number = Date.now()): boolean {
  const flag = { ready: true, timestamp };
  (window as unknown as Window & Record<string, unknown>)[options.readyFlagName] = flag;

  if (!document.body) return false;
  document.body.dataset[options.datasetReadyKey] = 'true';
  document.body.dataset[options.datasetTimestampKey] = timestamp.toString();
  return true;
}

export function installCloudDrivePageScript(options: PageScriptInstallOptions): void {
  const capturedHeaders = new Map<string, string>();
  const allowHeader = new Set((options.captureHeaders || []).map(normalizeHeaderName));

  if (allowHeader.size > 0) {
    const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.setRequestHeader = function setRequestHeader(name: string, value: string): void {
      if (allowHeader.has(normalizeHeaderName(name))) {
        capturedHeaders.set(name, value);
      }
      return originalSetRequestHeader.call(this, name, value);
    };

    const originalFetch = window.fetch.bind(window);
    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      headers.forEach((value, key) => {
        if (allowHeader.has(normalizeHeaderName(key))) {
          capturedHeaders.set(key, value);
        }
      });
      return originalFetch(input, init);
    }) as typeof window.fetch;
  }

  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;
    const message = event.data as Partial<APIRequestMessage>;
    if (!message || message.type !== options.requestType || !message.requestId || !message.method || !message.url) return;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), message.timeout || 30000);

    try {
      const encoded = createBodyAndHeaders(message.body);
      const headers = new Headers();
      for (const [key, value] of capturedHeaders.entries()) headers.set(key, value);
      appendHeaders(headers, encoded.headers);

      const response = await fetch(message.url, {
        method: message.method,
        credentials: 'include',
        headers,
        body: message.method.toUpperCase() === 'GET' ? undefined : encoded.body,
        signal: controller.signal,
      });
      window.clearTimeout(timeoutId);

      const text = await response.text();
      let data: unknown = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { text };
        }
      }

      window.postMessage({
        type: options.responseType,
        requestId: message.requestId,
        success: response.ok,
        data,
        status: response.status,
      }, '*');
    } catch (error) {
      window.clearTimeout(timeoutId);
      console.error(`[CDR] [${options.logPrefix}] API request failed:`, message.requestId, error);
      window.postMessage({
        type: options.responseType,
        requestId: message.requestId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }, '*');
    }
  });

  markPageScriptReady(options);
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', () => {
      markPageScriptReady(options);
    }, { once: true });
  }
}
