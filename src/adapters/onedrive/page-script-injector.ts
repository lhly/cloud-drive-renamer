export interface OneDriveBridgeResponse {
  data?: unknown;
  status?: number;
  headers?: Record<string, string>;
}

export class OneDrivePageScriptInjector {
  async call(operation: 'directory' | 'children' | 'item' | 'rename', options: { itemId?: string; continuation?: string; expectedOldName?: string; expectedParentId?: string; newName?: string } = {}): Promise<OneDriveBridgeResponse> {
    const requestId = `OneDrive-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const deadline = Date.now() + 25000;
    const request = { type: 'ONEDRIVE_API_REQUEST', requestId, operation, deadline, ...options };
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        window.removeEventListener('message', onMessage);
        reject(new Error('OneDrive API request timeout'));
      }, 30000);
      const onMessage = (event: MessageEvent) => {
        if (event.source !== window || event.origin !== window.location.origin) return;
        const response = event.data;
        if (!response || response.type !== 'ONEDRIVE_API_RESPONSE' || response.requestId !== requestId) return;
        window.clearTimeout(timeout);
        window.removeEventListener('message', onMessage);
        if (response.success) resolve({ data: response.data, status: response.status, headers: response.headers });
        else reject(Object.assign(new Error(response.error || 'OneDrive API request failed'), {
          status: response.status,
          headers: response.headers,
        }));
      };
      window.addEventListener('message', onMessage);
      window.postMessage(request, window.location.origin);
    });
  }
}
