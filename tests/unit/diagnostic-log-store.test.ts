import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageManager } from '../../src/utils/storage';
import { DiagnosticLogStore } from '../../src/background/diagnostic-log-store';
import { DIAGNOSTIC_STORAGE_KEYS, type DiagnosticLogEntry } from '../../src/types/diagnostic';

describe('DiagnosticLogStore', () => {
  let mockChromeStorage: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockChromeStorage = {
      get: vi.fn(() => Promise.resolve({})),
      set: vi.fn(() => Promise.resolve()),
      remove: vi.fn(() => Promise.resolve()),
    };

    global.chrome = {
      storage: {
        local: mockChromeStorage,
      },
    } as any;

    global.localStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    } as any;
  });

  it('keeps only the latest 300 diagnostic log entries', async () => {
    let currentLogs: DiagnosticLogEntry[] = [];
    mockChromeStorage.get.mockImplementation(async () => ({
      [DIAGNOSTIC_STORAGE_KEYS.RECENT_LOGS]: currentLogs,
    }));
    mockChromeStorage.set.mockImplementation(async (payload: Record<string, DiagnosticLogEntry[]>) => {
      currentLogs = payload[DIAGNOSTIC_STORAGE_KEYS.RECENT_LOGS] ?? [];
    });

    const store = new DiagnosticLogStore(new StorageManager());

    for (let i = 0; i < 305; i++) {
      await store.append({ id: `log-${i}`, level: 'INFO', message: `m-${i}` } as DiagnosticLogEntry);
    }

    const logs = await store.getRecent();
    expect(logs).toHaveLength(300);
    expect(logs[0].id).toBe('log-5');
    expect(logs.at(-1)?.id).toBe('log-304');
  });

  it('does not lose logs when append is called concurrently', async () => {
    let currentLogs: DiagnosticLogEntry[] = [];

    const concurrentStorage = {
      get: vi.fn(async () => {
        const snapshot = [...currentLogs];
        await new Promise((resolve) => setTimeout(resolve, 0));
        return snapshot;
      }),
      set: vi.fn(async (_key: string, value: DiagnosticLogEntry[]) => {
        currentLogs = value;
      }),
      remove: vi.fn(async () => {}),
    };

    const store = new DiagnosticLogStore(concurrentStorage as any);

    await Promise.all([
      store.append({ id: 'log-a', level: 'INFO', message: 'A' }),
      store.append({ id: 'log-b', level: 'INFO', message: 'B' }),
    ]);

    expect(currentLogs).toHaveLength(2);
    expect(currentLogs.map((item) => item.id)).toEqual(['log-a', 'log-b']);
  });


  it('clears the buffer without touching unrelated keys', async () => {
    const store = new DiagnosticLogStore(new StorageManager());

    await store.clear();

    expect(mockChromeStorage.remove).toHaveBeenCalledTimes(1);
    expect(mockChromeStorage.remove).toHaveBeenNthCalledWith(1, DIAGNOSTIC_STORAGE_KEYS.RECENT_LOGS);
    expect(mockChromeStorage.remove).not.toHaveBeenCalledWith(DIAGNOSTIC_STORAGE_KEYS.LAST_FAILURE);
  });
});
