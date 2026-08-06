interface APIRequest {
  type: 'UC_API_REQUEST';
  requestId: string;
  method: string;
  url: string;
  body?: unknown;
}

interface APIResponse {
  type: 'UC_API_RESPONSE';
  requestId: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

window.addEventListener('message', async (event) => {
  if (event.source !== window) return;

  const message = event.data as APIRequest;
  if (message.type !== 'UC_API_REQUEST') return;

  try {
    let requestUrl = message.url;
    if (message.method === 'POST' && requestUrl.includes('/file/rename')) {
      const url = new URL(requestUrl);
      if (!url.searchParams.has('pr')) url.searchParams.set('pr', 'UCBrowser');
      if (!url.searchParams.has('fr')) url.searchParams.set('fr', 'pc');
      if (!url.searchParams.has('uc_param_str')) url.searchParams.set('uc_param_str', '');
      requestUrl = url.toString();
    }

    const xhr = new XMLHttpRequest();
    xhr.open(message.method, requestUrl, true);
    xhr.setRequestHeader('Accept', 'application/json, text/plain, */*');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.withCredentials = true;

    xhr.onload = function() {
      try {
        const result = JSON.parse(xhr.responseText);
        const successResponse: APIResponse = {
          type: 'UC_API_RESPONSE',
          requestId: message.requestId,
          success: true,
          data: result,
        };
        window.postMessage(successResponse, '*');
      } catch (parseError) {
        const errorResponse: APIResponse = {
          type: 'UC_API_RESPONSE',
          requestId: message.requestId,
          success: false,
          error: 'Failed to parse response JSON',
        };
        window.postMessage(errorResponse, '*');
        console.error('[CDR] [UCPageScript] JSON parse error:', message.requestId, parseError);
      }
    };

    xhr.onerror = function() {
      const errorResponse: APIResponse = {
        type: 'UC_API_RESPONSE',
        requestId: message.requestId,
        success: false,
        error: 'Network error',
      };
      window.postMessage(errorResponse, '*');
      console.error('[CDR] [UCPageScript] Network error:', message.requestId);
    };

    xhr.send(message.body ? JSON.stringify(message.body) : undefined);
  } catch (error) {
    const errorResponse: APIResponse = {
      type: 'UC_API_RESPONSE',
      requestId: message.requestId,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
    window.postMessage(errorResponse, '*');
    console.error('[CDR] [UCPageScript] API request failed:', message.requestId, error);
  }
});

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

window.__UC_PAGE_SCRIPT_LOADED__ = true;

export function markUCPageScriptReady(timestamp: number = Date.now()): boolean {
  window.__UC_PAGE_SCRIPT_READY__ = {
    ready: true,
    timestamp,
  };

  if (!document.body) {
    return false;
  }

  document.body.dataset.ucPageScriptReady = 'true';
  document.body.dataset.ucPageScriptTimestamp = timestamp.toString();
  return true;
}

markUCPageScriptReady();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    markUCPageScriptReady();
    window.postMessage({ type: 'UC_PAGE_SCRIPT_READY' }, '*');
  }, { once: true });
} else {
  window.postMessage({ type: 'UC_PAGE_SCRIPT_READY' }, '*');
}
