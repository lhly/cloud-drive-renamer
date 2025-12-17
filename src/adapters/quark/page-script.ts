/**
 * 页面脚本 - 在网页真实上下文中执行
 * 用于调用需要Cookie认证的夸克API
 *
 * 通信协议:
 * Content Script -> Page Script: { type: 'QUARK_API_REQUEST', requestId, method, url, body }
 * Page Script -> Content Script: { type: 'QUARK_API_RESPONSE', requestId, success, data/error }
 */

// Make this file a module to allow global augmentation
export {};

interface APIRequest {
  type: 'QUARK_API_REQUEST';
  requestId: string;
  method: string;
  url: string;
  body?: any;
}

interface APIResponse {
  type: 'QUARK_API_RESPONSE';
  requestId: string;
  success: boolean;
  data?: any;
  error?: string;
}

// 监听来自 content script 的消息
window.addEventListener('message', async (event) => {
  // 只处理来自同一窗口的消息
  if (event.source !== window) return;

  const message = event.data as APIRequest;

  // 只处理夸克API请求
  if (message.type !== 'QUARK_API_REQUEST') return;

  try {
    // 提取和解析 Cookie
    const cookies = document.cookie;
    const cookieObj: Record<string, string> = {};
    cookies.split(';').forEach(cookie => {
      const [key, value] = cookie.trim().split('=');
      if (key && value) {
        cookieObj[key] = value;
      }
    });

    // 关键修复：使用 XMLHttpRequest 而不是 fetch
    // 因为 XMLHttpRequest 在 MAIN world 中会正确携带页面的 cookies
    const xhr = new XMLHttpRequest();

    // 关键修复：添加完整的 URL 参数（必须包含 uc_param_str）
    let requestUrl = message.url;
    if (message.method === 'POST' && requestUrl.includes('/file/rename')) {
      const url = new URL(requestUrl);
      // 添加夸克 API 必需的参数（按官方请求顺序）
      if (!url.searchParams.has('pr')) url.searchParams.set('pr', 'ucpro');
      if (!url.searchParams.has('fr')) url.searchParams.set('fr', 'pc');
      // 关键：uc_param_str 参数必须存在（即使是空值）
      if (!url.searchParams.has('uc_param_str')) url.searchParams.set('uc_param_str', '');
      requestUrl = url.toString();
    }

    xhr.open(message.method, requestUrl, true);

    // 设置必需的请求头（完全匹配官方请求）
    xhr.setRequestHeader('Accept', 'application/json, text/plain, */*');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Referer', 'https://pan.quark.cn/');
    xhr.setRequestHeader('Origin', 'https://pan.quark.cn');

    // 添加可能需要的额外请求头
    // 注意：浏览器会自动添加 User-Agent，无需手动设置
    if (cookieObj['ctoken']) {
      // 尝试将关键 token 作为自定义头发送（如果夸克API支持）
      try {
        xhr.setRequestHeader('X-Pan-Token', cookieObj['ctoken']);
      } catch (e) {
        // Token设置失败，继续使用Cookie认证
      }
    }

    xhr.withCredentials = true;  // 重要：携带 cookies

    xhr.onload = function() {
      try {
        const result = JSON.parse(xhr.responseText);

        // 发送成功响应
        const successResponse: APIResponse = {
          type: 'QUARK_API_RESPONSE',
          requestId: message.requestId,
          success: true,
          data: result,
        };

        window.postMessage(successResponse, '*');
      } catch (parseError) {
        // JSON 解析失败
        const errorResponse: APIResponse = {
          type: 'QUARK_API_RESPONSE',
          requestId: message.requestId,
          success: false,
          error: 'Failed to parse response JSON',
        };

        window.postMessage(errorResponse, '*');
        console.error('[CDR] [PageScript] JSON parse error:', message.requestId, parseError);
      }
    };

    xhr.onerror = function() {
      // 网络错误
      const errorResponse: APIResponse = {
        type: 'QUARK_API_RESPONSE',
        requestId: message.requestId,
        success: false,
        error: 'Network error',
      };

      window.postMessage(errorResponse, '*');
      console.error('[CDR] [PageScript] Network error:', message.requestId);
    };

    // 发送请求
    if (message.body) {
      xhr.send(JSON.stringify(message.body));
    } else {
      xhr.send();
    }

  } catch (error) {
    // 其他错误
    const errorResponse: APIResponse = {
      type: 'QUARK_API_RESPONSE',
      requestId: message.requestId,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };

    window.postMessage(errorResponse, '*');
    console.error('[CDR] [PageScript] API request failed:', message.requestId, error);
  }
});

/**
 * Type-safe flag structure matching page-script-injector.ts
 */
interface PageScriptReadyFlag {
  ready: boolean;
  timestamp: number;
}

/**
 * Extend Window interface for type-safe global flag access
 * Enables type checking and prevents runtime type errors
 */
declare global {
  interface Window {
    __QUARK_PAGE_SCRIPT_READY__?: PageScriptReadyFlag;
    __QUARK_PAGE_SCRIPT_LOADED__?: boolean;
  }
}

/**
 * Mark page script as loaded and ready
 *
 * Sets multiple signals to handle different race condition scenarios:
 * 1. Legacy window flags (for backward compatibility, but may not work across worlds)
 * 2. **DOM-based persistent flag (PRIMARY)** - Uses document.body.dataset for cross-world communication
 * 3. postMessage event for real-time notification
 *
 * The DOM dataset approach enables reliable cross-world communication since
 * both MAIN world (page-script) and ISOLATED world (content script) can access the same DOM.
 * This solves the Chrome world isolation issue where window properties cannot be shared.
 */
// Set legacy window flags (may not work due to world isolation)
window.__QUARK_PAGE_SCRIPT_LOADED__ = true;
const flagTimestamp = Date.now();
window.__QUARK_PAGE_SCRIPT_READY__ = {
  ready: true,
  timestamp: flagTimestamp
};

// === PRIMARY: Set DOM-based flag for cross-world communication ===
// This is the reliable method that works across MAIN and ISOLATED worlds
// Defensive null check: document.body may be null at document_start
if (document.body) {
  // Fast path: body already exists (common case after DOMContentLoaded)
  document.body.dataset.quarkPageScriptReady = 'true';
  document.body.dataset.quarkPageScriptTimestamp = flagTimestamp.toString();
} else {
  // Fallback: defer to DOMContentLoaded when body is not ready yet
  // This ensures we don't lose the DOM dataset signal even at document_start
  document.addEventListener('DOMContentLoaded', () => {
    const deferredTimestamp = Date.now();
    document.body.dataset.quarkPageScriptReady = 'true';
    document.body.dataset.quarkPageScriptTimestamp = deferredTimestamp.toString();
  }, { once: true });
}

// Send postMessage event for real-time notification
// Note: This is sent immediately regardless of body readiness for lowest latency
window.postMessage({ type: 'QUARK_PAGE_SCRIPT_READY' }, '*');
