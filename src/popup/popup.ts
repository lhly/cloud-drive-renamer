import { logger } from '../utils/logger';
import { storage } from '../utils/storage';
import { PlatformName } from '../types/platform';
import { PlatformUsageStats, STORAGE_KEYS } from '../types/stats';
import { APP_VERSION_WITH_PREFIX } from '../shared/version';
import { I18nService } from '../utils/i18n';
import { LanguageChangeMessage } from '../types/i18n';
import { detectPlatformFromUrl } from '../utils/platform-detector';

/**
 * Popup脚本
 */

// 注意: 平台检测逻辑已迁移到 src/utils/platform-detector.ts
// 使用统一的 detectPlatformFromUrl() 函数

/**
 * 获取平台显示名称（动态翻译）
 * @param platform 平台标识
 * @returns 平台显示名称
 */
function getPlatformDisplayName(platform: PlatformName): string {
  const translationKey = `platform_${platform}`;
  return I18nService.t(translationKey);
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

/**
 * Internationalize HTML elements with data-i18n attribute
 */
function localizeHTML() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = I18nService.t(key);
    }
  });
}

/**
 * Update platform display name based on current tab
 * Extracts duplicated logic and removes global state mutation
 */
async function updatePlatformDisplayName() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    if (currentTab?.url) {
      const platformKey = detectPlatformFromUrl(currentTab.url);
      if (platformKey) {
        // Dynamically get translated name using unified interface
        const translatedName = getPlatformDisplayName(platformKey);
        updatePlatformName(translatedName);
      } else {
        updatePlatformName(I18nService.t('popup_platform_unsupported'));
      }
    }
  } catch (error) {
    logger.error('Failed to update platform display name:', error as Error);
  }
}

/**
 * Handle language change messages
 * Extracted as named function for proper cleanup
 */
function handleLanguageChange(message: any) {
  if ((message as LanguageChangeMessage).type === 'LANGUAGE_CHANGED') {
    // Update all internationalized text when language changes
    localizeHTML();

    // Update platform name with new translations
    updatePlatformDisplayName().catch(error => {
      logger.error('Failed to update platform name after language change:', error);
    });
  }
}

/**
 * Setup language change listener with cleanup mechanism
 */
function setupLanguageChangeListener() {
  chrome.runtime.onMessage.addListener(handleLanguageChange);

  // Cleanup listener when popup unloads
  window.addEventListener('unload', () => {
    chrome.runtime.onMessage.removeListener(handleLanguageChange);
  });
}

// 初始化Popup
async function initPopup() {
  // 1. First initialize language selector (loads and sets currentLanguage asynchronously)
  await initLanguageSelector();

  // 2. After language initialization, localize HTML with correct language
  localizeHTML();

  // 3. Inject version number to footer
  injectVersion();

  // 4. Setup language change listener with cleanup mechanism
  setupLanguageChangeListener();

  // 获取当前标签页
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabs[0];

  if (!currentTab || !currentTab.url) {
    updatePlatformName(I18nService.t('popup_platform_none'));
    return;
  }

  // 检测平台
  // 使用统一的检测逻辑 (移除旧的本地实现)
  const platformKey = detectPlatformFromUrl(currentTab.url);
  if (platformKey) {
    // 使用统一的函数获取翻译
    const translatedName = getPlatformDisplayName(platformKey);
    updatePlatformName(translatedName);
    // 初始化悬浮按钮开关 - 支持的平台
    await initFloatingButtonToggle(platformKey);
    // 加载统计数据 - 传入平台信息
    await loadStats(platformKey);
    // 初始化重置按钮 - 传入平台信息
    initResetButton(platformKey);
  } else {
    updatePlatformName(I18nService.t('popup_platform_unsupported'));
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

// 注意: detectPlatformFromUrl() 已迁移到 src/utils/platform-detector.ts
// 这里不再需要本地实现

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
    const confirmed = confirm(I18nService.t('popup_reset_confirm', [platformName]));

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
      alert(I18nService.t('popup_reset_failed'));
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
    toggleHint.textContent = I18nService.t('popup_toggle_hint_supported');
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
    toggleHint.textContent = I18nService.t('popup_toggle_hint_unsupported');
    toggleHint.className = 'toggle-hint inactive';
  }
}

/**
 * 显示Toast提示
 * @param message 提示消息
 * @param duration 显示时长(毫秒)
 */
function showToast(message: string, duration = 2000) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

/**
 * 初始化语言选择器
 */
async function initLanguageSelector() {
  const languageSelect = document.getElementById('language-select') as HTMLSelectElement;
  if (!languageSelect) return;

  // 获取当前语言并设置选中状态
  const currentLang = await I18nService.getCurrentLanguage();
  languageSelect.value = currentLang;

  // 监听语言切换
  languageSelect.addEventListener('change', async (e) => {
    const newLang = (e.target as HTMLSelectElement).value as 'zh_CN' | 'zh_TW' | 'en';

    try {
      // 设置新语言
      await I18nService.setLanguage(newLang);

      // 更新页面所有文本
      localizeHTML();

      // 显示Toast提示
      const langName = {
        'zh_CN': '简体中文',
        'zh_TW': '繁體中文',
        'en': 'English'
      }[newLang];

      showToast(I18nService.t('toast_language_changed', [langName]));

      // 更新平台名称翻译（使用提取的函数，消除重复代码）
      await updatePlatformDisplayName();
    } catch (error) {
      logger.error('Failed to change language:', error as Error);
      showToast(I18nService.t('toast_language_change_failed'));
    }
  });
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
