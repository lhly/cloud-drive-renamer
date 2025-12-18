/**
 * 平台检测工具模块
 * 统一 content script 和 popup 的平台检测逻辑
 */

import { PlatformName } from '../types/platform';

/**
 * 夸克网盘分享链接路径模式
 * 所有包含这些模式的路径都被识别为分享链接页面
 */
export const QUARK_SHARE_LINK_PATTERNS = ['/s/'] as const;

/**
 * 检测URL是否为夸克网盘分享链接
 * @param pathname - URL路径部分
 * @returns 是否为分享链接
 */
export function isQuarkShareLink(pathname: string | null | undefined): boolean {
  // 防御性检查: 确保 pathname 存在且为字符串
  if (!pathname || typeof pathname !== 'string') {
    return false;
  }

  // 检查路径是否包含任何分享链接模式
  return QUARK_SHARE_LINK_PATTERNS.some(pattern => pathname.includes(pattern));
}

/**
 * 从URL检测平台类型
 * @param url - 完整URL
 * @param pathname - URL路径部分 (可选, 用于分享链接检测)
 * @returns 平台名称或null
 */
export function detectPlatformFromUrl(url: string, pathname?: string): PlatformName | null {
  // 夸克网盘
  if (url.includes('pan.quark.cn')) {
    // 使用统一的分享链接检测函数
    // 如果未提供pathname，尝试从URL解析
    const pathToCheck = pathname ?? extractPathnameFromUrl(url);

    if (isQuarkShareLink(pathToCheck)) {
      return null; // 分享链接页面不支持
    }

    return 'quark';
  }

  // 阿里云盘 (未来支持)
  if (url.includes('www.aliyundrive.com')) {
    return 'aliyun';
  }

  // 百度网盘 (未来支持)
  if (url.includes('pan.baidu.com')) {
    return 'baidu';
  }

  return null;
}

/**
 * 从完整URL中提取pathname部分
 * @param url - 完整URL
 * @returns pathname字符串
 */
function extractPathnameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname;
  } catch {
    // URL解析失败，返回空字符串
    return '';
  }
}
