/**
 * 解析文件名为名称和扩展名
 * @param fullName 完整文件名
 * @returns 名称和扩展名
 */
export function parseFileName(fullName: string): { name: string; ext: string } {
  const lastDot = fullName.lastIndexOf('.');
  if (lastDot === -1 || lastDot === 0 || lastDot === fullName.length - 1) {
    return { name: fullName, ext: '' };
  }
  return {
    name: fullName.substring(0, lastDot),
    ext: fullName.substring(lastDot),
  };
}

/**
 * 延迟执行
 * @param ms 延迟毫秒数
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 验证文件名是否合法
 * @param fileName 文件名
 * @returns 验证结果
 */
export function validateFileName(fileName: string): {
  valid: boolean;
  illegalChars?: string[];
  sanitized?: string;
} {
  const illegalChars = /[/\\:*?"<>|]/g;
  const matches = fileName.match(illegalChars);

  if (matches) {
    return {
      valid: false,
      illegalChars: [...new Set(matches)],
      sanitized: fileName.replace(illegalChars, '_'),
    };
  }

  return { valid: true };
}

/**
 * 清理文件名中的非法字符
 * @param fileName 文件名
 * @param replacement 替换字符
 * @returns 清理后的文件名
 */
export function sanitizeFileName(fileName: string, replacement: string = '_'): string {
  const illegalChars = /[/\\:*?"<>|]/g;
  return fileName.replace(illegalChars, replacement).replace(/\s+/g, ' ').trim();
}

/**
 * 格式化时间
 * @param ms 毫秒数
 * @returns 格式化的时间字符串
 */
export function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}秒`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return `${minutes}分${remainingSeconds}秒`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}小时${remainingMinutes}分`;
}

/**
 * 生成UUID
 * @returns UUID字符串
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 防抖函数
 * @param fn 要执行的函数
 * @param delay 延迟时间
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return function (this: any, ...args: Parameters<T>) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * 节流函数
 * @param fn 要执行的函数
 * @param delay 延迟时间
 * @returns 节流后的函数
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  return function (this: any, ...args: Parameters<T>) {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      fn.apply(this, args);
    }
  };
}
