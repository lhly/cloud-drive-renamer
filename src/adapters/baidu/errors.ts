/**
 * Baidu API Error Class
 */
export class BaiduAPIError extends Error {
  constructor(
    public errno: number,
    message: string,
    public response?: any
  ) {
    super(message);
    this.name = 'BaiduAPIError';
  }
}

/**
 * Baidu API Error Code Mapping
 * Based on observed API responses
 */
export const ERROR_CODES: Record<string, string> = {
  '0': '成功',
  '2': '参数错误',
  '3': '权限错误',
  '4': '网络超时',
  '110': '会话已过期',
  '111': '访问令牌无效',
  '112': 'Session已失效',
  '-1': '文件或目录不存在',
  '-2': '用户未登录或登录失败',
  '-3': '文件已存在',
  '-4': '目录已存在',
  '-7': '非法路径',
  '-8': '文件名非法',
  '-9': '文件或目录不存在',
  '-10': '磁盘配额不足',
  '-11': '父目录不存在',
};

/**
 * Get user-friendly error message
 */
export function getErrorMessage(errno: number, defaultMessage?: string): string {
  const key = errno.toString();
  return ERROR_CODES[key] || defaultMessage || `未知错误 (errno: ${errno})`;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: any): boolean {
  // Network errors are retryable
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  // Timeout errors are retryable
  if (error.name === 'AbortError') {
    return true;
  }

  // API errors: network timeout (4), session expired (110-112) are retryable
  if (error instanceof BaiduAPIError) {
    return error.errno === 4 ||
           error.errno === 110 ||
           error.errno === 111 ||
           error.errno === 112;
  }

  return false;
}
