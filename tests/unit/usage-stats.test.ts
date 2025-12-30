import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { recordUsageStatsDelta } from '../../src/utils/usage-stats';
import { STORAGE_KEYS } from '../../src/types/stats';

describe('Usage stats', () => {
  const platform = 'quark' as const;
  const storageKey = STORAGE_KEYS.USAGE_STATS_PREFIX + platform;

  let mockChromeStorage: any;

  beforeEach(() => {
    mockChromeStorage = {
      get: vi.fn(() => Promise.resolve({})),
      set: vi.fn(() => Promise.resolve()),
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

    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create stats for a platform when missing', async () => {
    mockChromeStorage.get.mockResolvedValueOnce({});

    await recordUsageStatsDelta(platform, { success: 2, failed: 1 });

    expect(mockChromeStorage.get).toHaveBeenCalledWith(storageKey);
    expect(mockChromeStorage.set).toHaveBeenCalledWith({
      [storageKey]: {
        platform,
        successCount: 2,
        failedCount: 1,
        lastUpdated: 1700000000000,
      },
    });
  });

  it('should accumulate stats when existing value present', async () => {
    mockChromeStorage.get.mockResolvedValueOnce({
      [storageKey]: {
        platform,
        successCount: 5,
        failedCount: 2,
        lastUpdated: 1,
      },
    });

    await recordUsageStatsDelta(platform, { success: 3, failed: 4 });

    expect(mockChromeStorage.set).toHaveBeenCalledWith({
      [storageKey]: {
        platform,
        successCount: 8,
        failedCount: 6,
        lastUpdated: 1700000000000,
      },
    });
  });

  it('should no-op when delta is zero', async () => {
    await recordUsageStatsDelta(platform, { success: 0, failed: 0 });
    expect(mockChromeStorage.get).not.toHaveBeenCalled();
    expect(mockChromeStorage.set).not.toHaveBeenCalled();
  });
});

