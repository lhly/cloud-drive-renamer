/**
 * 使用统计相关类型定义
 */

/**
 * 平台使用统计数据
 */
export interface PlatformUsageStats {
  /** 平台标识 */
  platform: string;
  /** 成功次数 */
  successCount: number;
  /** 失败次数 */
  failedCount: number;
  /** 最后更新时间戳 */
  lastUpdated: number;
}

/**
 * Storage key 前缀常量
 */
export const STORAGE_KEYS = {
  /** 悬浮按钮可见性前缀 */
  VISIBILITY_PREFIX: 'floatingButton_visibility_',
  /** 使用统计前缀 */
  USAGE_STATS_PREFIX: 'usage_stats_',
} as const;
