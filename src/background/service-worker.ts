import { logger } from '../utils/logger';

/**
 * Service Worker (Background Script)
 * Manifest V3的后台脚本
 */

// 扩展安装事件
chrome.runtime.onInstalled.addListener(details => {
  logger.info('Extension installed', details);

  if (details.reason === 'install') {
    // 首次安装
    logger.info('First time installation');
    // 可以在这里初始化默认配置
    chrome.storage.local.set({
      config: {
        defaultPlatform: 'quark',
        requestInterval: 800,
        maxRetries: 3,
      },
    });
  } else if (details.reason === 'update') {
    // 扩展更新
    logger.info('Extension updated', details.previousVersion);
  }
});

// 监听消息
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {

  switch (message.type) {
    case 'GET_CONFIG':
      // 获取配置
      chrome.storage.local.get('config', result => {
        sendResponse({ config: result.config });
      });
      return true; // 保持消息通道打开

    case 'SAVE_CONFIG':
      // 保存配置
      chrome.storage.local.set({ config: message.config }, () => {
        sendResponse({ success: true });
      });
      return true;

    case 'LOG':
      // 记录日志
      logger.info('Log from content script:', message.data);
      sendResponse({ success: true });
      break;

    default:
      logger.warn('Unknown message type:', message.type);
  }

  return false;
});

// 监听标签页更新
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {

    // 检测是否是支持的网盘平台
    if (
      tab.url.includes('pan.quark.cn') ||
      tab.url.includes('www.aliyundrive.com') ||
      tab.url.includes('pan.baidu.com')
    ) {
      logger.info('Supported cloud drive detected:', tab.url);
    }
  }
});

logger.info('CloudDrive Renamer Service Worker initialized');
