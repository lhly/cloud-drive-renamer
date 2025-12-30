import type { PlatformName } from '../types/platform';
import type { PlatformUsageStats } from '../types/stats';
import { STORAGE_KEYS } from '../types/stats';
import { logger } from './logger';
import { storage } from './storage';

function getUsageStatsKey(platform: PlatformName): string {
  return STORAGE_KEYS.USAGE_STATS_PREFIX + platform;
}

function normalizeDelta(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

export async function recordUsageStatsDelta(
  platform: PlatformName,
  delta: { success: number; failed: number }
): Promise<void> {
  const successDelta = normalizeDelta(delta.success);
  const failedDelta = normalizeDelta(delta.failed);

  if (successDelta === 0 && failedDelta === 0) {
    return;
  }

  const storageKey = getUsageStatsKey(platform);

  try {
    const current = await storage.get<PlatformUsageStats>(storageKey);

    const next: PlatformUsageStats = {
      platform,
      successCount: (current?.successCount ?? 0) + successDelta,
      failedCount: (current?.failedCount ?? 0) + failedDelta,
      lastUpdated: Date.now(),
    };

    await storage.set(storageKey, next);
  } catch (error) {
    logger.error(`[UsageStats] Failed to update stats for ${platform}`, error as Error);
  }
}

