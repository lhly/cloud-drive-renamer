/**
 * Page Script for Baidu Drive - Runs in MAIN world
 * Used to call Baidu API with cookie authentication
 *
 * Communication Protocol:
 * Content Script -> Page Script: { type: 'BAIDU_API_REQUEST', requestId, method, url, body }
 * Page Script -> Content Script: { type: 'BAIDU_API_RESPONSE', requestId, success, data/error }
 */

export {};

interface APIRequest {
  type: 'BAIDU_API_REQUEST';
  requestId: string;
  method: string;
  url: string;
  body?: any;
}

interface APIResponse {
  type: 'BAIDU_API_RESPONSE';
  requestId: string;
  success: boolean;
  data?: any;
  error?: string;
}

// Listen for GET_BDSTOKEN requests
window.addEventListener('message', (event) => {
  // Only process messages from same window
  if (event.source !== window) return;

  const message = event.data;

  // Handle GET_BDSTOKEN request
  if (message.type === 'GET_BDSTOKEN') {
    let bdstoken: string | null = null;

    // Method 1: From window.locals.userInfo.bdstoken (primary method in MAIN world)
    try {
      const windowLocals = (window as any).locals;
      if (windowLocals && windowLocals.userInfo && windowLocals.userInfo.bdstoken) {
        bdstoken = windowLocals.userInfo.bdstoken as string;
      }
    } catch (error) {
      console.error('[CDR] [BaiduPageScript] Error accessing window.locals:', error);
    }

    // Method 2: From yunData.MYBDSTOKEN (fallback)
    if (!bdstoken) {
      try {
        const yunData = (window as any).yunData;
        if (yunData && yunData.MYBDSTOKEN) {
          bdstoken = yunData.MYBDSTOKEN as string;
        }
      } catch (error) {
        console.error('[CDR] [BaiduPageScript] Error accessing yunData:', error);
      }
    }

    // Send response back to content script
    window.postMessage({
      type: 'BDSTOKEN_RESPONSE',
      requestId: message.requestId,
      bdstoken: bdstoken,
      success: !!bdstoken,
    }, '*');
  }
});

// Listen for messages from content script
window.addEventListener('message', async (event) => {
  // Only process messages from same window
  if (event.source !== window) return;

  const message = event.data as APIRequest;

  // Only handle Baidu API requests
  if (message.type !== 'BAIDU_API_REQUEST') return;

  try {
    // Use XMLHttpRequest for proper cookie handling
    const xhr = new XMLHttpRequest();
    xhr.open(message.method, message.url, true);

    // Set required headers (excluding Referer/Origin which browser sets automatically)
    xhr.setRequestHeader('Accept', 'application/json, text/plain, */*');
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    // Browser automatically sets these headers with correct values

    xhr.withCredentials = true;  // Critical: include cookies

    xhr.onload = function() {
      try {
        const result = JSON.parse(xhr.responseText);

        const successResponse: APIResponse = {
          type: 'BAIDU_API_RESPONSE',
          requestId: message.requestId,
          success: true,
          data: result,
        };

        window.postMessage(successResponse, '*');
      } catch (parseError) {
        console.error('[CDR] [BaiduPageScript] JSON parse error:', message.requestId, parseError);

        const errorResponse: APIResponse = {
          type: 'BAIDU_API_RESPONSE',
          requestId: message.requestId,
          success: false,
          error: 'Failed to parse response JSON',
        };

        window.postMessage(errorResponse, '*');
      }
    };

    xhr.onerror = function() {
      console.error('[CDR] [BaiduPageScript] Network error:', message.requestId);

      const errorResponse: APIResponse = {
        type: 'BAIDU_API_RESPONSE',
        requestId: message.requestId,
        success: false,
        error: 'Network error',
      };

      window.postMessage(errorResponse, '*');
    };

    // Send request with URL-encoded body (Baidu API requirement)
    if (message.body) {
      const formData = new URLSearchParams();
      for (const [key, value] of Object.entries(message.body)) {
        formData.append(key, String(value));
      }
      xhr.send(formData.toString());
    } else {
      xhr.send();
    }

  } catch (error) {
    console.error('[CDR] [BaiduPageScript] API request failed:', message.requestId, error);

    const errorResponse: APIResponse = {
      type: 'BAIDU_API_RESPONSE',
      requestId: message.requestId,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };

    window.postMessage(errorResponse, '*');
  }
});

/**
 * Type-safe flag structure
 */
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

/**
 * Mark page script as loaded and ready
 * Uses DOM dataset for cross-world communication
 */
window.__BAIDU_PAGE_SCRIPT_LOADED__ = true;
const flagTimestamp = Date.now();
window.__BAIDU_PAGE_SCRIPT_READY__ = {
  ready: true,
  timestamp: flagTimestamp
};

// Set DOM-based flag (PRIMARY method for cross-world communication)
if (document.body) {
  document.body.dataset.baiduPageScriptReady = 'true';
  document.body.dataset.baiduPageScriptTimestamp = flagTimestamp.toString();
} else {
  // Timing issue - wait for DOMContentLoaded
  console.warn('[CDR] [BaiduPageScript] document.body not available, using DOMContentLoaded');
  document.addEventListener('DOMContentLoaded', () => {
    const deferredTimestamp = Date.now();
    document.body.dataset.baiduPageScriptReady = 'true';
    document.body.dataset.baiduPageScriptTimestamp = deferredTimestamp.toString();
  }, { once: true });
}

// Send postMessage event for real-time notification
window.postMessage({ type: 'BAIDU_PAGE_SCRIPT_READY' }, '*');
