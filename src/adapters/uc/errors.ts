export class UCAPIError extends Error {
  constructor(
    public code: number,
    message: string,
    public response?: unknown
  ) {
    super(message);
    this.name = 'UCAPIError';
  }
}

const ERROR_CODES: Record<number, string> = {
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

export function getErrorMessage(code: number, defaultMessage?: string): string {
  return ERROR_CODES[code] || defaultMessage || `未知错误 (code: ${code})`;
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof UCAPIError) {
    return error.code === 429 || error.code >= 500;
  }

  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  if (error instanceof Error) {
    return error.name === 'AbortError' || error.message.toLowerCase().includes('timeout');
  }

  return false;
}
