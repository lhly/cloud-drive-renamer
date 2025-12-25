/**
 * Aliyun Drive Page Script - Runs in MAIN world
 * Handles token-based authentication and API calls
 *
 * Key Differences from Quark/Baidu:
 * - Uses Bearer Token (from localStorage) instead of Cookie
 * - Requires x-device-id and x-canary headers
 * - May require x-signature for security (TBD)
 */

export {};

interface APIRequest {
  type: 'ALIYUN_API_REQUEST';
  requestId: string;
  method: string;
  url: string;
  body?: any;
}

interface APIResponse {
  type: 'ALIYUN_API_RESPONSE';
  requestId: string;
  success: boolean;
  data?: any;
  error?: string;
}

interface ExtractFiberRequest {
  type: 'EXTRACT_REACT_FIBER_REQUEST';
  requestId: string;
  selector: string; // CSS selector to find the element
}

interface ExtractFiberResponse {
  type: 'EXTRACT_REACT_FIBER_RESPONSE';
  requestId: string;
  success: boolean;
  data?: {
    driveId: string;
    fileId: string;
  };
  error?: string;
}

/**
 * Extract access_token from localStorage
 */
function getAccessToken(): string | null {
  try {
    const tokenStr = localStorage.getItem('token');
    if (!tokenStr) return null;

    const tokenData = JSON.parse(tokenStr);
    return tokenData.access_token || null;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[CDR] [AliyunPageScript] Failed to parse token:', error);
    return null;
  }
}

/**
 * Extract device_id from localStorage
 * Try multiple possible key names used by Aliyun Drive
 */
function getDeviceId(): string | null {
  try {
    // Try common key variations
    const possibleKeys = [
      'device_id',
      'deviceId',
      'DEVICE_ID',
      'device-id',
      'aliyun_device_id',
      'alipan_device_id'
    ];

    for (const key of possibleKeys) {
      const value = localStorage.getItem(key);
      if (value) {
        return value;
      }
    }

    // If not found in localStorage, try to generate a temporary one
    // eslint-disable-next-line no-console
    console.warn('[CDR] [AliyunPageScript] device_id not found in localStorage, using fallback');

    // Generate a UUID-like device_id as fallback
    return generateFallbackDeviceId();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[CDR] [AliyunPageScript] Failed to get device_id:', error);
    return null;
  }
}

/**
 * Generate a fallback device_id when not found in localStorage
 */
function generateFallbackDeviceId(): string {
  // Generate a simple UUID v4-like string
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get x-canary header value
 * Format: client=web,app=adrive,version=v6.8.12
 *
 * Dynamically extracts version from page metadata or script tags
 */
function getCanaryHeader(): string {
  try {
    // Priority 1: Extract from meta tag
    const metaVersion = document.querySelector('meta[name="app-version"], meta[name="version"]');
    if (metaVersion) {
      const version = metaVersion.getAttribute('content');
      if (version) {
        // Ensure version format: v6.8.12
        const normalizedVersion = version.startsWith('v') ? version : `v${version}`;
        return `client=web,app=adrive,version=${normalizedVersion}`;
      }
    }

    // Priority 2: Extract from script tags
    const scripts = document.querySelectorAll('script[src*="aliyun"], script[src*="adrive"]');
    for (const script of Array.from(scripts)) {
      const src = script.getAttribute('src');
      if (src) {
        // Match version pattern in URL: /v6.8.12/ or version=6.8.12
        const match = src.match(/[/=]v?(\d+\.\d+\.\d+)/);
        if (match) {
          return `client=web,app=adrive,version=v${match[1]}`;
        }
      }
    }

    // Priority 3: Extract from window object properties
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const windowAny = window as any;
    if (windowAny.__APP_VERSION__) {
      const version = String(windowAny.__APP_VERSION__);
      const normalizedVersion = version.startsWith('v') ? version : `v${version}`;
      return `client=web,app=adrive,version=${normalizedVersion}`;
    }

    // Priority 4: Extract from localStorage
    const appConfig = localStorage.getItem('appConfig') || localStorage.getItem('app_version');
    if (appConfig) {
      const config = JSON.parse(appConfig);
      if (config.version) {
        const normalizedVersion = config.version.startsWith('v') ? config.version : `v${config.version}`;
        return `client=web,app=adrive,version=${normalizedVersion}`;
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[CDR] [AliyunPageScript] Failed to detect app version:', error);
  }

  // Conservative fallback: use recent stable version
  // Updated: 2025-12-23
  return 'client=web,app=adrive,version=v6.8.12';
}

/**
 * Extract React Fiber data from DOM element (MAIN world only)
 *
 * This function MUST run in MAIN world because:
 * - React Fiber properties are non-enumerable (enumerable: false)
 * - Chrome's security membrane filters non-enumerable properties
 * - Object.getOwnPropertyNames() only works in MAIN world
 *
 * @param selector - CSS selector to find the element
 * @returns File data (driveId and fileId) or null
 */
function extractReactFiberData(selector: string): { driveId: string; fileId: string } | null {
  try {
    // Find the element
    const element = document.querySelector(selector);

    if (!element) {
      return null;
    }

    // Use Object.getOwnPropertyNames() to find React Fiber key
    const ownProps = Object.getOwnPropertyNames(element);
    const fiberKeys = ownProps.filter(key => key.startsWith('__reactFiber'));

    if (fiberKeys.length === 0) {
      return null;
    }

    const fiberKey = fiberKeys[0];

    // Access the Fiber node
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fiber = (element as any)[fiberKey];

    if (!fiber) {
      return null;
    }

    // Traverse the Fiber tree to find file data
    const MAX_DEPTH = 15;
    let current = fiber;

    for (let depth = 0; depth < MAX_DEPTH && current; depth++) {
      // Check if memoizedProps exists and has 'file' property
      if (current.memoizedProps?.file) {
        const fileData = current.memoizedProps.file;

        // Extract driveId and fileId (handle both camelCase and snake_case)
        const driveId = fileData.driveId || fileData.drive_id;
        const fileId = fileData.fileId || fileData.file_id;

        if (driveId && fileId) {
          return { driveId, fileId };
        }
      }

      // Move to parent Fiber node
      current = current.return;
    }

    return null;

  } catch (error) {
    return null;
  }
}


// Listen for messages from content script
window.addEventListener('message', async (event) => {
  if (event.source !== window) return;

  const message = event.data;

  // Handle React Fiber extraction requests
  if (message.type === 'EXTRACT_REACT_FIBER_REQUEST') {
    const fiberRequest = message as ExtractFiberRequest;

    try {
      const fiberData = extractReactFiberData(fiberRequest.selector);

      if (fiberData) {
        const successResponse: ExtractFiberResponse = {
          type: 'EXTRACT_REACT_FIBER_RESPONSE',
          requestId: fiberRequest.requestId,
          success: true,
          data: fiberData,
        };

        window.postMessage(successResponse, '*');
      } else {
        const failureResponse: ExtractFiberResponse = {
          type: 'EXTRACT_REACT_FIBER_RESPONSE',
          requestId: fiberRequest.requestId,
          success: false,
          error: 'Failed to extract React Fiber data',
        };

        window.postMessage(failureResponse, '*');
      }
    } catch (error) {
      const errorResponse: ExtractFiberResponse = {
        type: 'EXTRACT_REACT_FIBER_RESPONSE',
        requestId: fiberRequest.requestId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };

      window.postMessage(errorResponse, '*');
    }

    return; // Done handling Fiber request
  }

  // Handle API requests
  if (message.type !== 'ALIYUN_API_REQUEST') return;

  const apiRequest = message as APIRequest;

  try {
    // Extract authentication credentials
    const accessToken = getAccessToken();
    if (!accessToken) {
      throw new Error('未找到access_token，请确保已登录阿里云盘');
    }

    const deviceId = getDeviceId();
    if (!deviceId) {
      throw new Error('无法获取device_id，请确保已登录阿里云盘');
    }

    // Prepare request headers
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'x-device-id': deviceId,
      'x-canary': getCanaryHeader(),
    };

    // Note: x-signature may be required for some operations
    // If API returns 401/403, implement signature generation logic

    // Make API call using fetch (in MAIN world)
    const response = await fetch(apiRequest.url, {
      method: apiRequest.method,
      headers: headers,
      body: apiRequest.body ? JSON.stringify(apiRequest.body) : undefined,
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    // Send success response
    const successResponse: APIResponse = {
      type: 'ALIYUN_API_RESPONSE',
      requestId: apiRequest.requestId,
      success: true,
      data: result,
    };

    window.postMessage(successResponse, '*');
  } catch (error) {
    // Send error response
    const errorResponse: APIResponse = {
      type: 'ALIYUN_API_RESPONSE',
      requestId: apiRequest.requestId,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };

    window.postMessage(errorResponse, '*');
    // eslint-disable-next-line no-console
    console.error('[CDR] [AliyunPageScript] API request failed:', apiRequest.requestId, error);
  }
});

/**
 * Intercept /v3/file/list API responses to auto-cache file metadata
 * This ensures fileCache is always populated before user operations
 */
function interceptFileListAPI(): void {
  const originalFetch = window.fetch;

  window.fetch = async function (...args: Parameters<typeof fetch>): Promise<Response> {
    const [resource] = args;
    const url = typeof resource === 'string' ? resource : (resource as Request).url;

    // Call original fetch
    const response = await originalFetch.apply(this, args);

    // Intercept /v3/file/list responses
    if (url.includes('/v3/file/list')) {
      try {
        // Clone response to avoid consuming body
        const clonedResponse = response.clone();
        const data = await clonedResponse.json();

        // Extract file list from response
        if (data.items && Array.isArray(data.items)) {
          // Send file list to content script for caching
          window.postMessage({
            type: 'ALIYUN_FILE_LIST_INTERCEPTED',
            files: data.items,
          }, '*');

          // eslint-disable-next-line no-console
          console.debug('[CDR] [AliyunPageScript] Intercepted file list:', data.items.length, 'files');
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('[CDR] [AliyunPageScript] Failed to intercept file list:', error);
      }
    }

    return response;
  };

  // eslint-disable-next-line no-console
  console.debug('[CDR] [AliyunPageScript] File list API interception enabled');
}

// Enable API interception
interceptFileListAPI();

// Mark page script as ready
const flagTimestamp = Date.now();

// Set DOM-based flag for cross-world communication (PRIMARY method)
if (document.body) {
  document.body.dataset.aliyunPageScriptReady = 'true';
  document.body.dataset.aliyunPageScriptTimestamp = flagTimestamp.toString();
} else {
  document.addEventListener('DOMContentLoaded', () => {
    document.body.dataset.aliyunPageScriptReady = 'true';
    document.body.dataset.aliyunPageScriptTimestamp = Date.now().toString();
  }, { once: true });
}

// Send postMessage event for real-time notification
window.postMessage({ type: 'ALIYUN_PAGE_SCRIPT_READY' }, '*');
