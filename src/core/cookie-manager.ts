import { logger } from '../utils/logger';

/**
 * Cookie管理器
 *
 * 核心功能:
 * - 检测Cookie过期(401/403)
 * - 暂停所有操作
 * - 显示刷新页面提示
 *
 * @example
 * ```typescript
 * const cookieManager = new CookieManager();
 *
 * // 在API响应处理中
 * const isValid = await cookieManager.detectCookieExpiration(response);
 * if (!isValid) {
 *   // 操作已暂停,等待用户刷新页面
 * }
 * ```
 */
export class CookieManager {
  private isValid = true;
  private hasShownDialog = false;

  /**
   * 检测Cookie是否过期
   * @param response Fetch响应对象
   * @returns Cookie是否有效
   */
  async detectCookieExpiration(response: Response): Promise<boolean> {
    // 检测401或403状态码
    if (response.status === 401 || response.status === 403) {
      logger.warn('Cookie expired detected', {
        status: response.status,
        url: response.url,
      });

      this.isValid = false;
      this.pauseAllOperations();

      // 只显示一次对话框
      if (!this.hasShownDialog) {
        this.hasShownDialog = true;
        this.showRefreshDialog();
      }

      return false;
    }

    return true;
  }

  /**
   * 检查Cookie是否有效
   */
  isValidCookie(): boolean {
    return this.isValid;
  }

  /**
   * 重置Cookie状态
   */
  resetCookieState(): void {
    this.isValid = true;
    this.hasShownDialog = false;
  }

  /**
   * 显示刷新页面对话框
   */
  showRefreshDialog(): void {
    const confirmed = confirm(
      '登录已过期,请刷新页面重新登录后继续操作。\n\n' + '点击确定将刷新页面。'
    );

    if (confirmed) {
      logger.info('User confirmed page refresh');
      window.location.reload();
    } else {
      logger.info('User cancelled page refresh');
    }
  }

  /**
   * 暂停所有正在进行的操作
   */
  pauseAllOperations(): void {
    logger.info('Pausing all operations due to cookie expiration');

    // 发送全局暂停事件
    window.dispatchEvent(
      new CustomEvent('pause-all-operations', {
        detail: {
          reason: 'cookie_expired',
          timestamp: Date.now(),
        },
      })
    );
  }

  /**
   * 创建包含Cookie检测的Fetch封装
   * @param url 请求URL
   * @param options Fetch选项
   * @returns Response对象
   */
  async fetchWithCookieCheck(url: string, options: RequestInit = {}): Promise<Response> {
    try {
      const response = await fetch(url, options);

      // 检测Cookie过期
      await this.detectCookieExpiration(response);

      return response;
    } catch (error) {
      logger.error('Fetch with cookie check failed:', error as Error);
      throw error;
    }
  }
}

/**
 * 全局Cookie管理器实例
 */
export const cookieManager = new CookieManager();

/**
 * 监听全局暂停事件(用于Executor等组件)
 */
export function listenForPauseEvents(onPause: () => void): () => void {
  const handler = (event: CustomEvent) => {
    logger.info('Received pause-all-operations event', event.detail);
    onPause();
  };

  window.addEventListener('pause-all-operations', handler as EventListener);

  // 返回清理函数
  return () => {
    window.removeEventListener('pause-all-operations', handler as EventListener);
  };
}
