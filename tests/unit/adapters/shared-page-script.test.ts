import { describe, it, expect, vi, afterEach } from 'vitest';
import { installCloudDrivePageScript, markPageScriptReady } from '../../../src/adapters/shared/page-script';
import { CMCC_PAGE_SCRIPT_OPTIONS } from '../../../src/adapters/cmcc/page-script';

describe('shared cloud drive page script', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('does not throw when marking ready before document.body exists', () => {
    const body = document.body;
    Object.defineProperty(document, 'body', { value: null, configurable: true });

    expect(() => markPageScriptReady({
      requestType: 'TEST_READY_REQUEST',
      responseType: 'TEST_READY_RESPONSE',
      readyFlagName: '__TEST_READY__',
      datasetReadyKey: 'testReady',
      datasetTimestampKey: 'testTimestamp',
      logPrefix: 'TestReady',
    })).not.toThrow();

    Object.defineProperty(document, 'body', { value: body, configurable: true });
  });

  it('uses XHR transport for CMCC so request header casing is preserved', () => {
    expect(CMCC_PAGE_SCRIPT_OPTIONS.transport).toBe('xhr');
  });

  it('sends API requests with original header casing in XHR transport', async () => {
    const sentHeaders: Array<[string, string]> = [];
    const openedRequests: Array<{ method: string; url: string }> = [];

    class FakeXHR {
      static DONE = 4;
      readyState = 0;
      status = 200;
      responseText = '{"success":true}';
      withCredentials = false;
      onreadystatechange: (() => void) | null = null;
      onerror: (() => void) | null = null;
      ontimeout: (() => void) | null = null;
      timeout = 0;

      open(method: string, url: string): void {
        openedRequests.push({ method, url });
      }

      setRequestHeader(name: string, value: string): void {
        sentHeaders.push([name, value]);
      }

      send(): void {
        this.readyState = FakeXHR.DONE;
        this.onreadystatechange?.();
      }
    }

    const originalXHR = window.XMLHttpRequest;
    Object.defineProperty(window, 'XMLHttpRequest', { value: FakeXHR, configurable: true });

    installCloudDrivePageScript({
      requestType: 'TEST_XHR_REQUEST',
      responseType: 'TEST_XHR_RESPONSE',
      readyFlagName: '__TEST_XHR_READY__',
      datasetReadyKey: 'testXhrReady',
      datasetTimestampKey: 'testXhrTimestamp',
      logPrefix: 'TestXHR',
      transport: 'xhr',
    });

    const requestEvent = new MessageEvent('message', {
      data: {
        type: 'TEST_XHR_REQUEST',
        requestId: 'request-1',
        method: 'POST',
        url: 'https://example.com/api',
        body: {
          bodyMode: 'json',
          data: { ok: true },
          headers: {
            'CMS-DEVICE': 'default',
            'INNER-HCY-ROUTER-HTTPS': '1',
            'X-SvcType': '1',
          },
        },
      },
    });
    Object.defineProperty(requestEvent, 'source', { value: window });
    window.dispatchEvent(requestEvent);
    await Promise.resolve();

    expect(openedRequests).toEqual([{ method: 'POST', url: 'https://example.com/api' }]);
    expect(sentHeaders).toEqual(expect.arrayContaining([
      ['Content-Type', 'application/json;charset=UTF-8'],
      ['CMS-DEVICE', 'default'],
      ['INNER-HCY-ROUTER-HTTPS', '1'],
      ['X-SvcType', '1'],
    ]));

    Object.defineProperty(window, 'XMLHttpRequest', { value: originalXHR, configurable: true });
  });
});
