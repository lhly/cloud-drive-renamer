import { PlatformAdapter, RenameResult } from '../types/platform';
import { logger } from '../utils/logger';
import { sleep } from '../utils/helpers';

/**
 * 重试配置接口
 */
export interface RetryConfig {
  /** 最大重试次数 */
  maxRetries: number;
  /** 基础延迟(毫秒),每次重试后会指数增长 */
  baseDelay: number;
  /** 是否显示重试通知 */
  showNotification: boolean;
}

/**
 * 默认重试配置
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1秒基础延迟
  showNotification: true,
};

/**
 * 判断是否是网络错误
 * @param error 错误对象
 * @returns 是否是网络错误
 */
export function isNetworkError(error: Error): boolean {
  const errorMessage = error.message.toLowerCase();

  return (
    errorMessage.includes('network') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('fetch') ||
    errorMessage.includes('connection') ||
    errorMessage.includes('failed to fetch') ||
    error.name === 'NetworkError' ||
    error.name === 'TimeoutError'
  );
}

/**
 * 显示重试通知
 * @param attempt 当前重试次数
 * @param maxRetries 最大重试次数
 * @param delay 延迟时间(毫秒)
 * @param fileName 文件名
 */
function showRetryNotification(
  attempt: number,
  maxRetries: number,
  delay: number,
  fileName?: string
): void {
  const fileInfo = fileName ? `文件: ${fileName}\n` : '';
  const message =
    `${fileInfo}网络错误,正在重试 (${attempt}/${maxRetries})\n` +
    `将在 ${Math.ceil(delay / 1000)} 秒后重试...`;

  // 使用非阻塞的toast通知(如果可用)
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('批量重命名 - 重试中', {
      body: message,
      icon: '/icons/icon48.png',
    });
  } else {
    // 降级到console输出
    logger.info('Retrying operation', {
      attempt,
      maxRetries,
      delay,
      fileName,
    });
  }
}

/**
 * 带重试机制的重命名函数
 *
 * @example
 * ```typescript
 * const result = await renameWithRetry(
 *   'file-123',
 *   'new-name.txt',
 *   adapter,
 *   { maxRetries: 3, baseDelay: 1000, showNotification: true }
 * );
 *
 * if (result.success) {
 *   console.log('Renamed successfully');
 * } else {
 *   console.error('Failed after retries:', result.error);
 * }
 * ```
 *
 * @param fileId 文件ID
 * @param newName 新文件名
 * @param adapter 平台适配器
 * @param config 重试配置
 * @returns 重命名结果
 */
export async function renameWithRetry(
  fileId: string,
  newName: string,
  adapter: PlatformAdapter,
  config: Partial<RetryConfig> = {}
): Promise<RenameResult> {
  const { maxRetries, baseDelay, showNotification } = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  let lastError: Error | undefined;
  let lastResult: RenameResult | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await adapter.renameFile(fileId, newName);

      // 如果成功,直接返回
      if (result.success) {
        if (attempt > 1) {
          logger.info('Retry succeeded', { fileId, attempt });
        }
        return result;
      }

      // 如果失败但不是网络错误,不重试
      if (result.error && !isNetworkError(result.error)) {
        logger.info('Non-network error, skipping retry', {
          fileId,
          error: result.error.message,
        });
        return result;
      }

      lastResult = result;
      lastError = result.error;
    } catch (error) {
      lastError = error as Error;

      // 如果不是网络错误,不重试
      if (!isNetworkError(lastError)) {
        logger.error(`Non-network error, skipping retry for ${fileId}`, lastError);
        const error = lastError;
        return {
          success: false,
          error,
        };
      }
    }

    // 如果还有重试机会,等待后重试
    if (attempt < maxRetries) {
      // 指数退避: 1s, 2s, 4s
      const delay = baseDelay * Math.pow(2, attempt - 1);

      if (showNotification) {
        showRetryNotification(attempt, maxRetries, delay, newName);
      }

      logger.warn('Network error, retrying', {
        fileId,
        attempt,
        maxRetries,
        delay,
        error: lastError?.message,
      });

      await sleep(delay);
      continue;
    }
  }

  // 所有重试都失败
  logger.error(`All retries failed for ${fileId} after ${maxRetries} attempts`, lastError);

  const error = lastError || new Error('All retries failed');
  return (
    lastResult || {
      success: false,
      error,
    }
  );
}

/**
 * 批量重试配置
 */
export class RetryManager {
  private stats = {
    totalRetries: 0,
    successfulRetries: 0,
    failedRetries: 0,
  };

  constructor(private config: RetryConfig = DEFAULT_RETRY_CONFIG) {}

  /**
   * 执行带重试的重命名
   */
  async rename(fileId: string, newName: string, adapter: PlatformAdapter): Promise<RenameResult> {
    const result = await renameWithRetry(fileId, newName, adapter, this.config);

    // 更新统计
    if (!result.success) {
      this.stats.totalRetries++;
      this.stats.failedRetries++;
    } else if (result.success) {
      // 假设如果成功但之前有错误,表示重试成功
      this.stats.successfulRetries++;
    }

    return result;
  }

  /**
   * 获取重试统计
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * 重置统计
   */
  resetStats() {
    this.stats = {
      totalRetries: 0,
      successfulRetries: 0,
      failedRetries: 0,
    };
  }
}
