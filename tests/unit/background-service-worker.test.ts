import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RUNTIME_MESSAGE_TYPES } from '../../src/types/runtime-message';

type RuntimeMessageListener = (
  message: Record<string, unknown>,
  sender: unknown,
  sendResponse: (response: unknown) => void
) => boolean | void;

let runtimeMessageListener: RuntimeMessageListener | undefined;
let tabsQueryMock: ReturnType<typeof vi.fn>;
let tabsSendMessageMock: ReturnType<typeof vi.fn>;

function installChromeMock(tabs: Array<{ id?: number; url?: string }> = []): void {
  runtimeMessageListener = undefined;
  tabsSendMessageMock = vi.fn(() => Promise.resolve());
  tabsQueryMock = vi.fn((_queryInfo, callback: (result: typeof tabs) => void) => callback(tabs));

  (globalThis as typeof globalThis & { chrome: unknown }).chrome = {
    runtime: {
      onInstalled: { addListener: vi.fn() },
      onMessage: {
        addListener: vi.fn((listener: RuntimeMessageListener) => {
          runtimeMessageListener = listener;
        }),
      },
    },
    storage: {
      local: {
        get: vi.fn(),
        set: vi.fn(),
      },
    },
    tabs: {
      query: tabsQueryMock,
      sendMessage: tabsSendMessageMock,
      onUpdated: { addListener: vi.fn() },
    },
  };
}

async function loadServiceWorker(): Promise<RuntimeMessageListener> {
  await import('../../src/background/service-worker');
  if (!runtimeMessageListener) throw new Error('runtime message listener was not registered');
  return runtimeMessageListener;
}

describe('background service worker', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('broadcasts language changes to every supported cloud drive UI domain', async () => {
    installChromeMock([
      { id: 1, url: 'https://pan.quark.cn/list' },
      { id: 2, url: 'https://www.aliyundrive.com/drive' },
      { id: 3, url: 'https://www.alipan.com/drive' },
      { id: 4, url: 'https://pan.baidu.com/disk/main' },
      { id: 5, url: 'https://drive.uc.cn/list' },
      { id: 6, url: 'https://pan.uc.cn/list' },
      { id: 7, url: 'https://115.com/' },
      { id: 8, url: 'https://yun.123pan.cn/' },
      { id: 9, url: 'https://yun.139.com/w/#/main' },
      { id: 10, url: 'https://cloud.189.cn/web/main' },
      { id: 11, url: 'https://pan.xunlei.com/' },
      { id: 12, url: 'https://pc.woozooo.com/mydisk.php' },
      { id: 13, url: 'https://www.guangyapan.com/#/home/all' },
      { id: 14, url: 'https://example.com/' },
    ]);
    const listener = await loadServiceWorker();
    const sendResponse = vi.fn();

    listener({ type: 'LANGUAGE_CHANGED' }, {}, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({ success: true });
    expect(tabsQueryMock).toHaveBeenCalledWith({}, expect.any(Function));
    expect(tabsSendMessageMock.mock.calls.map((call) => call[0])).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  });

  it('aborts GuangyaPan background API requests when the runtime timeout elapses', async () => {
    vi.useFakeTimers();
    installChromeMock();
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    vi.stubGlobal('fetch', fetchMock);
    const listener = await loadServiceWorker();
    const sendResponse = vi.fn();

    const handled = listener({
      type: RUNTIME_MESSAGE_TYPES.GUANGYAPAN_API_REQUEST,
      requestId: 'req-timeout',
      method: 'POST',
      url: 'https://api.guangyapan.com/userres/v1/file/get_file_list',
      headers: { 'Content-Type': 'application/json' },
      body: { pageSize: 100 },
      timeout: 25,
    }, {}, sendResponse);

    expect(handled).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(sendResponse).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(25);

    expect(sendResponse).toHaveBeenCalledWith({ success: false, error: 'AbortError: Aborted', status: 0 });
    vi.useRealTimers();
  });
});
