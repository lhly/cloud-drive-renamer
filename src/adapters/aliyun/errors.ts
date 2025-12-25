/**
 * Aliyun Drive API Error Handling
 * Based on OpenAPI documentation and error exploration
 */

export class AliyunAPIError extends Error {
  constructor(
    public code: string,
    message: string,
    public response?: any
  ) {
    super(message);
    this.name = 'AliyunAPIError';
  }
}

/**
 * Map Aliyun error codes to user-friendly messages
 *
 * Common error codes (from API documentation):
 * - NotFound.File: File not found
 * - AlreadyExist.File: File name already exists
 * - InvalidParameter.Name: Invalid filename
 * - Forbidden.FileNameLimit: Filename too long
 * - QuotaExhausted.Storage: Storage quota exceeded
 *
 * @param code - Error code from API
 * @param originalMessage - Original error message from API
 */
export function getErrorMessage(code: string, originalMessage?: string): string {
  const errorMap: Record<string, string> = {
    'NotFound.File': '文件不存在',
    'AlreadyExist.File': '文件名已存在',
    'InvalidParameter.Name': '文件名无效',
    'Forbidden.FileNameLimit': '文件名过长',
    'QuotaExhausted.Storage': '存储空间不足',
    'InvalidParameter.RefreshToken': 'Token已过期，请刷新页面',
    'AccessTokenInvalid': 'Token无效，请重新登录',
    'Forbidden.NoPermission': '无权限执行此操作',
    'TooManyRequests': '请求过于频繁，请稍后重试',
  };

  return errorMap[code] || originalMessage || `未知错误: ${code}`;
}

/**
 * Determine if an error is retryable
 *
 * Retryable errors:
 * - Network errors
 * - Rate limit errors (TooManyRequests)
 * - Server errors (5xx)
 *
 * Non-retryable errors:
 * - Authentication errors (token invalid)
 * - Client errors (4xx except 429)
 * - Business logic errors (file not found, name conflict)
 *
 * @param error - Error object
 */
export function isRetryableError(error: any): boolean {
  if (error instanceof AliyunAPIError) {
    const retryableCodes = [
      'TooManyRequests',
      'InternalError.Timeout',
      'ServiceUnavailable',
    ];
    return retryableCodes.includes(error.code);
  }

  // Network errors are retryable
  if (error.name === 'NetworkError' || error.message.includes('fetch')) {
    return true;
  }

  // Timeout errors are retryable
  if (error.message.includes('timeout')) {
    return true;
  }

  return false;
}
