import { logger } from '../utils/logger';
import { storage } from '../utils/storage';
import { PlatformName } from '../types/platform';
import { PlatformUsageStats, STORAGE_KEYS } from '../types/stats';
import { APP_VERSION_WITH_PREFIX } from '../shared/version';

/**
 * Popup脚本
 */

// 平台URL到平台名称的映射
// 注意：只包含真正实现了content script和adapter的平台
const PLATFORM_URL_MAP: Record<string, { name: string; key: PlatformName }> = {
  'pan.quark.cn': { name: '夸克网盘', key: 'quark' },
  // 未来支持的平台在此添加
  // 'www.aliyundrive.com': { name: '阿里云盘', key: 'aliyun' },
  // 'pan.baidu.com': { name: '百度网盘', key: 'baidu' },
};

/**
 * 获取平台显示名称
 * @param platform 平台标识
 * @returns 平台显示名称
 */
function getPlatformDisplayName(platform: PlatformName): string {
  const entry = Object.values(PLATFORM_URL_MAP).find(p => p.key === platform);
  return entry?.name || platform;
}

/**
 * 注入版本号到页面 footer
 */
function injectVersion() {
  const footerEl = document.querySelector('.footer');
  if (footerEl) {
    footerEl.textContent = APP_VERSION_WITH_PREFIX;
  }
}

// 初始化Popup
async function initPopup() {
  // 注入版本号到 footer
  injectVersion();

  // 获取当前标签页
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabs[0];

  if (!currentTab || !currentTab.url) {
    updatePlatformName('未检测到平台');
    return;
  }

  // 检测平台
  const platformInfo = detectPlatformFromUrl(currentTab.url);
  if (platformInfo) {
    updatePlatformName(platformInfo.name);
    // 初始化悬浮按钮开关 - 支持的平台
    await initFloatingButtonToggle(platformInfo.key);
    // 加载统计数据 - 传入平台信息
    await loadStats(platformInfo.key);
    // 初始化重置按钮 - 传入平台信息
    initResetButton(platformInfo.key);
  } else {
    updatePlatformName('不支持的平台');
    // 初始化悬浮按钮开关 - 非支持的平台
    await initFloatingButtonToggle(null);
    // 加载统计数据 - 无平台
    await loadStats(null);
    // 初始化重置按钮 - 禁用状态
    initResetButton(null);
  }

  // 绑定事件
  bindEvents();
}

// 检测平台
function detectPlatformFromUrl(url: string): { name: string; key: PlatformName } | null {
  for (const [urlPattern, platformInfo] of Object.entries(PLATFORM_URL_MAP)) {
    if (url.includes(urlPattern)) {
      return platformInfo;
    }
  }
  return null;
}

// 更新平台名称显示
function updatePlatformName(name: string) {
  const platformNameEl = document.getElementById('platform-name');
  if (platformNameEl) {
    platformNameEl.textContent = name;
  }
}

// 加载统计数据 - 按平台
async function loadStats(platform: PlatformName | null) {
  try {
    const successCountEl = document.getElementById('success-count');
    const failedCountEl = document.getElementById('failed-count');

    if (!platform) {
      // 非支持平台，显示 0
      if (successCountEl) successCountEl.textContent = '0';
      if (failedCountEl) failedCountEl.textContent = '0';
      return;
    }

    // 读取当前平台的统计数据
    const storageKey = STORAGE_KEYS.USAGE_STATS_PREFIX + platform;
    const stats = await storage.get<PlatformUsageStats>(storageKey);

    if (successCountEl) {
      successCountEl.textContent = stats?.successCount?.toString() || '0';
    }

    if (failedCountEl) {
      failedCountEl.textContent = stats?.failedCount?.toString() || '0';
    }
  } catch (error) {
    logger.error('Failed to load stats:', error as Error);
  }
}

// 初始化重置按钮
function initResetButton(platform: PlatformName | null) {
  const resetButton = document.getElementById('reset-stats-button') as HTMLButtonElement;

  if (!resetButton) {
    logger.warn('Reset button element not found');
    return;
  }

  if (!platform) {
    // 非支持平台，禁用按钮
    resetButton.disabled = true;
    return;
  }

  // 启用按钮
  resetButton.disabled = false;

  // 绑定点击事件（带防抖保护）
  resetButton.addEventListener('click', async () => {
    const platformName = getPlatformDisplayName(platform);
    const confirmed = confirm(`确定要重置 ${platformName} 的统计数据吗？`);

    if (!confirmed) {
      return;
    }

    // 防抖保护：禁用按钮直到操作完成
    resetButton.disabled = true;

    try {
      // 删除当前平台的统计数据
      const storageKey = STORAGE_KEYS.USAGE_STATS_PREFIX + platform;
      await storage.remove(storageKey);

      // 刷新显示
      await loadStats(platform);

      logger.info(`Stats reset for platform: ${platform}`);
    } catch (error) {
      logger.error('Failed to reset stats:', error as Error);
      alert('重置失败，请重试');
    } finally {
      // 重新启用按钮
      resetButton.disabled = false;
    }
  });
}

// 初始化悬浮按钮开关（常显，根据平台状态控制可用性）
async function initFloatingButtonToggle(platform: PlatformName | null) {
  const toggleContainer = document.getElementById('floating-button-toggle');
  const toggleSwitch = document.getElementById('floating-button-switch') as HTMLInputElement;
  const toggleHint = document.getElementById('toggle-hint');

  if (!toggleContainer || !toggleSwitch || !toggleHint) {
    logger.warn('Toggle elements not found');
    return;
  }

  // 开关容器始终显示
  toggleContainer.style.display = 'flex';

  if (platform) {
    // 支持的平台 - 启用开关
    toggleSwitch.disabled = false;

    // 加载当前平台的可见性状态
    const storageKey = STORAGE_KEYS.VISIBILITY_PREFIX + platform;
    const isVisible = await storage.get<boolean>(storageKey);

    // 默认为显示（true）
    toggleSwitch.checked = isVisible !== false;

    // 更新提示文本 - 简化，避免重复
    toggleHint.textContent = '功能已启用';
    toggleHint.className = 'toggle-hint active';

    // 绑定开关事件
    toggleSwitch.addEventListener('change', async () => {
      const newVisibility = toggleSwitch.checked;
      await storage.set(storageKey, newVisibility);

      logger.info(`Floating button visibility for ${platform} set to:`, newVisibility);

      // 通知当前标签页更新按钮状态
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        try {
          await chrome.tabs.sendMessage(tabs[0].id, {
            type: 'FLOATING_BUTTON_VISIBILITY_CHANGED',
            platform,
            visible: newVisibility,
          });
        } catch (error) {
          logger.warn('Failed to send message to content script:', error);
        }
      }
    });
  } else {
    // 非支持的平台 - 禁用开关并强制为关闭状态
    toggleSwitch.disabled = true;
    toggleSwitch.checked = false;

    // 更新提示文本
    toggleHint.textContent = '当前页面不支持此功能';
    toggleHint.className = 'toggle-hint inactive';
  }
}

// 绑定事件
function bindEvents() {
  const helpLink = document.getElementById('help-link');
  if (helpLink) {
    helpLink.addEventListener('click', e => {
      e.preventDefault();
      chrome.tabs.create({
        url: 'https://github.com/lhly/cloud-drive-renamer#readme',
      });
    });
  }

  const feedbackLink = document.getElementById('feedback-link');
  if (feedbackLink) {
    feedbackLink.addEventListener('click', e => {
      e.preventDefault();
      chrome.tabs.create({
        url: 'https://github.com/lhly/cloud-drive-renamer/issues',
      });
    });
  }
}

// 启动
document.addEventListener('DOMContentLoaded', () => {
  initPopup();
});
