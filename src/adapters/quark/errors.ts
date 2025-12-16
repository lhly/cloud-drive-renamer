/**
 * 夸克 API 错误类
 */
export class QuarkAPIError extends Error {
  constructor(
    public code: number,
    message: string,
    public response?: any
  ) {
    super(message);
    this.name = 'QuarkAPIError';
  }
}

/**
 * 夸克 API 错误码映射
 */
export const ERROR_CODES: Record<number, string> = {
  0: '成功',
  401: '未登录或认证失败',
  403: '无权限访问',
  404: '文件不存在',
  409: '文件名冲突',
  429: '请求过于频繁',
  500: '服务器内部错误',
  1001: '参数错误',
  1002: '文件名非法',
  1003: '文件已存在',
};

/**
 * 获取友好的错误消息
 */
export function getErrorMessage(code: number, defaultMessage?: string): string {
  return ERROR_CODES[code] || defaultMessage || '未知错误';
}

/**
 * 判断错误是否可以重试
 */
export function isRetryableError(error: any): boolean {
  // 网络错误通常可以重试
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  // 超时错误可以重试
  if (error.name === 'AbortError') {
    return true;
  }

  // API 错误中，429 (限流)、500 (服务器错误) 可以重试
  if (error instanceof QuarkAPIError) {
    return error.code === 429 || error.code === 500;
  }

  return false;
}
