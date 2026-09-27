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
 * 阿里云盘分享链接路径模式 (用于文档说明)
 * 实际检测逻辑使用正则表达式严格匹配路径开头,避免误匹配
 * 示例: /s/abc123, /share/abc123
 * 不匹配: /files/, /settings/ (虽然包含's'字符)
 */
export const ALIYUN_SHARE_LINK_PATTERNS = ['/s/'] as const;

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
 * 检测URL是否为阿里云盘分享链接
 * @param pathname - URL路径部分
 * @returns 是否为分享链接
 */
export function isAliyunShareLink(pathname: string | null | undefined): boolean {
  // 防御性检查: 确保 pathname 存在且为字符串
  if (!pathname || typeof pathname !== 'string') {
    return false;
  }

  // 使用严格的边界匹配: 仅匹配以 /s/ 或 /share/ 开头的路径
  // 这避免了误匹配如 /files/, /settings/ 等包含 's' 字符的正常路径
  return /^\/s\/|^\/share\//.test(pathname);
}

/**
 * 从URL检测平台类型
 * @param url - 完整URL
 * @param pathname - URL路径部分 (可选, 用于分享链接检测)
 * @returns 平台名称或null
 */
export function detectPlatformFromUrl(url: string, pathname?: string): PlatformName | null {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol === 'https:' && parsedUrl.hostname === 'onedrive.live.com') {
      const pathToCheck = pathname ?? parsedUrl.pathname;
      return (pathToCheck === '/my' || pathToCheck === '/my/') ? 'onedrive' : null;
    }
  } catch {
    return null;
  }

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

  // 阿里云盘
  if (url.includes('www.aliyundrive.com') || url.includes('www.alipan.com')) {
    // 使用统一的分享链接检测函数
    // 如果未提供pathname，尝试从URL解析
    const pathToCheck = pathname ?? extractPathnameFromUrl(url);

    if (isAliyunShareLink(pathToCheck)) {
      return null; // 分享链接页面不支持
    }

    return 'aliyun';
  }

  // 115网盘
  if (url.includes('115.com')) {
    const pathToCheck = pathname ?? extractPathnameFromUrl(url);
    let mode: string | null = null;
    try {
      mode = new URL(url).searchParams.get('mode');
    } catch {
      mode = null;
    }
    if (pathToCheck === '/') {
      return '115';
    }
    if ((pathToCheck === '/storage/netdisk' || pathToCheck === '/storage/allfiles') && mode === 'wangpan') {
      return '115';
    }
    return null;
  }

  // 123云盘
  if (url.includes('yun.123pan.cn')) {
    return '123';
  }

  // 移动云盘
  if (url.includes('yun.139.com')) {
    const pathToCheck = pathname ?? extractPathnameFromUrl(url);
    return pathToCheck === '/w/' || url.includes('/w/#/main') || url.includes('/w/#/index') ? 'cmcc' : null;
  }

  // 天翼云盘
  if (url.includes('cloud.189.cn')) {
    const pathToCheck = pathname ?? extractPathnameFromUrl(url);
    return pathToCheck === '/web/main' || pathToCheck === '/web/main/' || pathToCheck.startsWith('/web/main/file') ? 'esurfing' : null;
  }

  // 迅雷云盘
  if (url.includes('pan.xunlei.com')) {
    return 'xunlei';
  }

  // 蓝奏云
  if (url.includes('pc.woozooo.com')) {
    const pathToCheck = pathname ?? extractPathnameFromUrl(url);
    return pathToCheck === '/mydisk.php' ? 'woozooo' : null;
  }

  // UC网盘
  if (url.includes('drive.uc.cn') || url.includes('pan.uc.cn')) {
    return 'uc';
  }

  // 百度网盘
  if (url.includes('pan.baidu.com')) {
    return 'baidu';
  }

  // 光鸭云盘 (hash-routed SPA: only match the UI host, not api/account subdomains)
  if (url.includes('www.guangyapan.com')) {
    return 'guangyapan';
  }

  // WKBrowser cloud drive (match UI host only, not api.wkbrowser.com)
  if (url.includes('pan.wkbrowser.com')) {
    return 'wkbrowser';
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
