import { describe, it, expect, vi, afterEach } from 'vitest';
import { installCloudDrivePageScript, markPageScriptReady } from '../../../src/adapters/shared/page-script';
import { CloudDrivePageScriptInjector } from '../../../src/adapters/shared/page-script-injector';
import { CMCC_PAGE_SCRIPT_OPTIONS } from '../../../src/adapters/cmcc/page-script';

describe('shared cloud drive page script', () => {
  afterEach(() => {
    vi.useRealTimers();
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

  it('keeps an already installed page script usable after the page has been open for more than one minute', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T01:40:00.000Z'));

    const timestamp = Date.now() - 120000;
    document.body.dataset.testStaleReady = 'true';
    document.body.dataset.testStaleTimestamp = timestamp.toString();
    (window as unknown as Window & Record<string, unknown>).__TEST_STALE_READY__ = { ready: true, timestamp };

    const injector = new CloudDrivePageScriptInjector({
      requestType: 'TEST_STALE_REQUEST',
      responseType: 'TEST_STALE_RESPONSE',
      readyFlagName: '__TEST_STALE_READY__',
      datasetReadyKey: 'testStaleReady',
      datasetTimestampKey: 'testStaleTimestamp',
      logPrefix: 'TestStale',
    });

    const requests: unknown[] = [];
    const handleRequest = (event: MessageEvent) => {
      const message = event.data as { type?: string; requestId?: string };
      if (message?.type !== 'TEST_STALE_REQUEST' || !message.requestId) return;

      requests.push(message);
      const responseEvent = new MessageEvent('message', {
        data: {
          type: 'TEST_STALE_RESPONSE',
          requestId: message.requestId,
          success: true,
          data: { ok: true },
        },
      });
      Object.defineProperty(responseEvent, 'source', { value: window });
      window.dispatchEvent(responseEvent);
    };
    window.addEventListener('message', handleRequest);

    const resultPromise = injector.callAPI('GET', 'https://example.com/api');
    await vi.runAllTimersAsync();

    await expect(resultPromise).resolves.toEqual({ ok: true });
    expect(requests).toHaveLength(1);

    window.removeEventListener('message', handleRequest);
  });

  it('reports status 0 as status 0 rather than unknown in the error message', async () => {
    vi.useFakeTimers();
    const timestamp = Date.now();
    document.body.dataset.testStatus0Ready = 'true';
    document.body.dataset.testStatus0Timestamp = timestamp.toString();
    (window as unknown as Window & Record<string, unknown>).__TEST_STATUS0_READY__ = { ready: true, timestamp };

    const injector = new CloudDrivePageScriptInjector({
      requestType: 'TEST_STATUS0_REQUEST',
      responseType: 'TEST_STATUS0_RESPONSE',
      readyFlagName: '__TEST_STATUS0_READY__',
      datasetReadyKey: 'testStatus0Ready',
      datasetTimestampKey: 'testStatus0Timestamp',
      logPrefix: 'TestStatus0',
    });

    const handleRequest = (event: MessageEvent) => {
      const message = event.data as { type?: string; requestId?: string };
      if (message?.type !== 'TEST_STATUS0_REQUEST' || !message.requestId) return;

      const responseEvent = new MessageEvent('message', {
        data: {
          type: 'TEST_STATUS0_RESPONSE',
          requestId: message.requestId,
          success: false,
          status: 0,
        },
      });
      Object.defineProperty(responseEvent, 'source', { value: window });
      window.dispatchEvent(responseEvent);
    };
    window.addEventListener('message', handleRequest);

    const requestPromise = injector.callAPI('GET', 'https://example.com/api').catch((e: unknown) => e);
    await vi.runAllTimersAsync();

    const error = await requestPromise;
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('TestStatus0 API request failed with status 0');

    window.removeEventListener('message', handleRequest);
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
