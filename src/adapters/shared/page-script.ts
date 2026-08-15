export interface PageScriptInstallOptions {
  requestType: string;
  responseType: string;
  readyFlagName: string;
  datasetReadyKey: string;
  datasetTimestampKey: string;
  logPrefix: string;
  captureHeaders?: string[];
  transport?: 'fetch' | 'xhr';
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

function parseResponseText(text: string): unknown {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

async function requestWithFetch(
  message: Partial<APIRequestMessage>,
  encoded: { body?: BodyInit; headers?: Record<string, string> },
  capturedHeaders: Map<string, string>,
  signal: AbortSignal
): Promise<{ success: boolean; status: number; body: unknown }> {
  const headers = new Headers();
  for (const [key, value] of capturedHeaders.entries()) headers.set(key, value);
  appendHeaders(headers, encoded.headers);

  const response = await fetch(message.url || '', {
    method: message.method,
    credentials: 'include',
    headers,
    body: message.method?.toUpperCase() === 'GET' ? undefined : encoded.body,
    signal,
  });
  const text = await response.text();
  return { success: response.ok, status: response.status, body: parseResponseText(text) };
}

function requestWithXhr(
  message: Partial<APIRequestMessage>,
  encoded: { body?: BodyInit; headers?: Record<string, string> },
  capturedHeaders: Map<string, string>
): Promise<{ success: boolean; status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(message.method || 'GET', message.url || '', true);
    xhr.withCredentials = true;
    if (message.timeout) xhr.timeout = message.timeout;

    for (const [key, value] of capturedHeaders.entries()) xhr.setRequestHeader(key, value);
    for (const [key, value] of Object.entries(encoded.headers || {})) xhr.setRequestHeader(key, value);

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== XMLHttpRequest.DONE) return;
      resolve({
        success: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        body: parseResponseText(xhr.responseText || ''),
      });
    };
    xhr.onerror = () => reject(new Error(`XHR request failed: ${message.url}`));
    xhr.ontimeout = () => reject(new Error(`XHR request timeout: ${message.url}`));

    xhr.send(message.method?.toUpperCase() === 'GET' ? undefined : (encoded.body as XMLHttpRequestBodyInit | undefined));
  });
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
      const data = options.transport === 'xhr'
        ? await requestWithXhr(message, encoded, capturedHeaders)
        : await requestWithFetch(message, encoded, capturedHeaders, controller.signal);
      window.clearTimeout(timeoutId);

      window.postMessage({
        type: options.responseType,
        requestId: message.requestId,
        success: data.success,
        data: data.body,
        status: data.status,
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
