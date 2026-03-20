import { configureLoggerDiagnostics, logger } from '../utils/logger';
import type { PlatformAdapter, PlatformName } from '../types/platform';
import { FloatingButton } from './components/floating-button';
import { AliyunAdapter } from '../adapters/aliyun/aliyun-adapter';
import { BaiduAdapter } from '../adapters/baidu/baidu-adapter';
import { QuarkAdapter } from '../adapters/quark/quark';
import { storage } from '../utils/storage';
import { STORAGE_KEYS } from '../types/stats';
import { I18nService } from '../utils/i18n';
import type { LanguageChangeMessage } from '../types/i18n';
import { detectPlatformFromUrl, isQuarkShareLink, isAliyunShareLink } from '../utils/platform-detector';
import { applyAppearanceToElement, getAppearanceMode, watchSystemColorScheme } from '../utils/appearance';
import { APPEARANCE_STORAGE_KEY, DEFAULT_APPEARANCE_MODE, isAppearanceMode, type AppearanceMode } from '../types/appearance';
import { RUNTIME_MESSAGE_TYPES } from '../types/runtime-message';

/**
 * Content Script
 * 注入到网盘页面的脚本
 *
 * 新架构:
 * - 使用悬浮按钮替代页面内按钮注入
 * - 使用 iframe 对话框替代直接的 Web Components
 * - 完全独立于页面结构
 * - 支持按平台控制悬浮按钮显示/隐藏
 */

// 🔍 VERSION IDENTIFIER - 用于诊断代码版本
// 全局初始化标志位（使用window对象实现跨执行上下文共享）
const INIT_FLAG = '__cloudDriveRenamerInitialized';

// 全局实例
let floatingButton: FloatingButton | null = null;
let fileSelectorPanel: (HTMLElement & { open: boolean; adapter: PlatformAdapter }) | null = null;
let platformAdapter: PlatformAdapter | null = null;
let currentAppearanceMode: AppearanceMode = DEFAULT_APPEARANCE_MODE;
let stopWatchSystemColorScheme: (() => void) | null = null;

// 初始化重试计数器（防止无限递归）
let initRetryCount = 0;
const MAX_INIT_RETRIES = 3;

configureLoggerDiagnostics({
  source: 'content',
  transport: async (entry) => {
    await chrome.runtime.sendMessage({
      type: RUNTIME_MESSAGE_TYPES.APPEND_DIAGNOSTIC_LOG,
      entry,
    });
  },
});

// 检测当前平台
// 使用统一的平台检测工具函数
export function detectPlatform(): PlatformName | null {
  const url = window.location.href;
  const pathname = window.location.pathname;

  // 使用统一的检测逻辑
  const platform = detectPlatformFromUrl(url, pathname);

  // 如果是分享链接,记录日志 (提升日志级别为 warn,因为这是需要用户关注的情况)
  if (url.includes('pan.quark.cn') && isQuarkShareLink(pathname)) {
    logger.warn('Quark share link detected, extension disabled for share pages');
  }
  if ((url.includes('www.aliyundrive.com') || url.includes('www.alipan.com')) && isAliyunShareLink(pathname)) {
    logger.warn('Aliyun share link detected, extension disabled for share pages');
  }

  return platform;
}

// 初始化
function init() {
  // 增强的初始化保护：检查标志位和UI实际状态
  if ((window as any)[INIT_FLAG]) {
    // 验证UI是否真的存在（检查Shadow DOM宿主元素）
    const existingShadowHost = document.querySelector('#cloud-drive-renamer-shadow-host');
    if (existingShadowHost) {
      logger.warn('Already initialized with UI present, skipping duplicate init() call');
      return;
    } else {
      // 标志位已设置但UI缺失，可能是异步mount正在进行中
      // 等待一小段时间（200ms）后重新检查DOM，避免误判异步竞态条件
      logger.warn('Initialization flag set but UI missing, checking if mount is in progress...');
      setTimeout(() => {
        const recheckShadowHost = document.querySelector('#cloud-drive-renamer-shadow-host');
        if (!recheckShadowHost) {
          // UI仍然缺失，检查重试次数
          initRetryCount++;
          if (initRetryCount < MAX_INIT_RETRIES) {
            logger.warn(`UI still missing after delay (retry ${initRetryCount}/${MAX_INIT_RETRIES}), allowing re-initialization`);
            delete (window as any)[INIT_FLAG];
            init();
          } else {
            logger.error(`Maximum initialization retries (${MAX_INIT_RETRIES}) exceeded, giving up`);
            delete (window as any)[INIT_FLAG]; // 释放标志位，允许用户手动刷新页面重试
          }
        } else {
          // UI已出现，说明异步mount正在进行中，不需要重新初始化
          logger.info('UI appeared after delay, initialization was in progress');
          initRetryCount = 0; // 成功检测到UI，重置计数器
        }
      }, 200); // 等待异步mount操作完成
      return; // 立即返回，不要继续执行初始化流程
    }
  }

  // 设置全局标志位（在window对象上，所有执行上下文共享）
  (window as any)[INIT_FLAG] = true;

  const platform = detectPlatform();

  if (!platform) {
    logger.warn('Unsupported platform');
    // 不支持的平台也重置标志位，允许后续重试
    delete (window as any)[INIT_FLAG];
    return;
  }

  // 等待DOM加载完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      injectUI(platform).catch((error) => {
        logger.error('Failed to inject UI on DOMContentLoaded:', error instanceof Error ? error : new Error(String(error)));
      });
    });
  } else {
    injectUI(platform).catch((error) => {
      logger.error('Failed to inject UI:', error instanceof Error ? error : new Error(String(error)));
    });
  }

  // 页面卸载时清理标志位（允许页面导航后重新初始化）
  window.addEventListener('beforeunload', () => {
    delete (window as any)[INIT_FLAG];
  });
}

/**
 * 清理旧的UI实例
 * 在重新初始化前调用，确保没有残留的DOM和事件监听器
 */
function cleanupOldInstances(): void {

  // 清理旧的悬浮按钮实例
  if (floatingButton) {
    try {
      floatingButton.unmount();
    } catch (error) {
      logger.error('Failed to unmount old floating button:', error instanceof Error ? error : new Error(String(error)));
    }
    floatingButton = null;
  }

  // 清理旧的文件选择面板实例
  if (fileSelectorPanel) {
    try {
      fileSelectorPanel.remove();
    } catch (error) {
      logger.error('Failed to close old file selector panel:', error instanceof Error ? error : new Error(String(error)));
    }
    fileSelectorPanel = null;
  }

  // 清理外观模式监听器（避免重复初始化导致泄漏）
  if (stopWatchSystemColorScheme) {
    stopWatchSystemColorScheme();
    stopWatchSystemColorScheme = null;
  }

  // 额外保护：手动移除可能残留的DOM元素（Shadow DOM宿主）
  const existingShadowHost = document.querySelector('#cloud-drive-renamer-shadow-host');
  if (existingShadowHost) {
    existingShadowHost.remove();
  }

  // 额外保护：移除可能残留的面板元素（避免变量丢失导致的泄漏）
  const existingPanel = document.querySelector('file-selector-panel');
  if (existingPanel) {
    existingPanel.remove();
  }
}

/**
 * 动态注入 page-script 到 MAIN world
 *
 * 背景: @crxjs/vite-plugin 不支持在 manifest.json 中直接配置 world: "MAIN" 的 TypeScript 文件
 * 解决方案: 在 content script (ISOLATED world) 中动态创建 <script> 标签注入到页面
 *
 * @param platform - 平台名称 (aliyun/baidu/quark)
 */
async function injectPageScriptToMainWorld(platform: 'aliyun' | 'baidu' | 'quark'): Promise<void> {
  // ✅ 引用编译后的 .js 文件（Vite 会将 TypeScript 编译为 JavaScript）
  const scriptPath = `src/adapters/${platform}/page-script.js`;
  const scriptURL = chrome.runtime.getURL(scriptPath);
  let script: HTMLScriptElement | null = null;

  try {
    // 创建 script 标签并注入到页面 (MAIN world)
    const scriptEl = document.createElement('script');
    script = scriptEl;
    scriptEl.src = scriptURL;
    scriptEl.type = 'module'; // 支持 ES6 模块

    // 等待脚本加载完成（加超时保护，避免 CSP/站点脚本拦截导致 onload/onerror 永不触发，从而阻塞整个悬浮按钮注入）
    const timeoutMs = 1500;
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        scriptEl.onload = null;
        scriptEl.onerror = null;
      };

      const timer = window.setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout loading page-script for ${platform}`));
      }, timeoutMs);

      scriptEl.onload = () => {
        window.clearTimeout(timer);
        cleanup();
        resolve();
      };
      scriptEl.onerror = () => {
        window.clearTimeout(timer);
        cleanup();
        reject(new Error(`Failed to load page-script for ${platform}`));
      };

      // 注入到页面
      (document.head || document.documentElement).appendChild(scriptEl);
    });

    // 脚本加载后可以移除标签 (代码已执行)
    scriptEl.remove();

    logger.info(`${platform} page-script injected to MAIN world successfully`);
  } catch (error) {
    // 不要阻塞悬浮按钮注入：即使 page-script 注入失败，也应该让 UI 先显示出来
    // 相关平台的 API 调用可能会退化/失败，但用户至少能看到按钮和面板，且能在控制台看到诊断信息
    logger.warn(
      `[DIAG] Failed to inject ${platform} page-script (continue without it):`,
      error instanceof Error ? error : new Error(String(error))
    );
  } finally {
    // Best-effort cleanup: 避免遗留无用的 <script>
    script?.remove();
  }
}

function createPlatformAdapter(platform: PlatformName): PlatformAdapter {
  switch (platform) {
    case 'aliyun':
      return new AliyunAdapter();
    case 'baidu':
      return new BaiduAdapter();
    case 'quark':
      return new QuarkAdapter();
  }
}

async function ensureCustomElementsReady(timeoutMs = 5000): Promise<boolean> {
  if (typeof customElements !== 'undefined' && customElements !== null && typeof customElements.define === 'function') {
    return true;
  }

  logger.warn('[WebComponents] customElements unavailable, attempting to load polyfills...');

  try {
    await import('./polyfills');
  } catch (error) {
    logger.error('[WebComponents] Failed to load polyfills module:', error instanceof Error ? error : new Error(String(error)));
  }

  const start = Date.now();

  return await new Promise<boolean>((resolve) => {
    let resolved = false;
    const cleanup = () => {
      window.removeEventListener('WebComponentsReady', onReady);
    };

    const onReady = () => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(true);
    };

    window.addEventListener('WebComponentsReady', onReady, { once: true });

    const poll = () => {
      if (resolved) return;
      if (typeof customElements !== 'undefined' && customElements !== null && typeof customElements.define === 'function') {
        resolved = true;
        cleanup();
        resolve(true);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        resolved = true;
        cleanup();
        resolve(false);
        return;
      }
      setTimeout(poll, 50);
    };

    poll();
  });
}

async function ensureFileSelectorPanel(platform: PlatformName): Promise<void> {
  if (!platformAdapter) {
    platformAdapter = createPlatformAdapter(platform);
  }

  if (fileSelectorPanel) {
    return;
  }

  const ready = await ensureCustomElementsReady();
  if (!ready) {
    logger.error('[FileSelectorPanel] customElements is still unavailable; cannot open panel');
    return;
  }

  try {
    await import('./components/file-selector-panel');
  } catch (error) {
    logger.error('[FileSelectorPanel] Failed to import panel module:', error instanceof Error ? error : new Error(String(error)));
    return;
  }

  const panelEl = document.createElement('file-selector-panel') as HTMLElement & {
    open: boolean;
    adapter: PlatformAdapter;
  };
  applyAppearanceToElement(panelEl, currentAppearanceMode);
  panelEl.adapter = platformAdapter;
  panelEl.open = false;
  panelEl.addEventListener('panel-close', () => {
    panelEl.open = false;
  });
  document.body.appendChild(panelEl);
  fileSelectorPanel = panelEl;
}

function applyAppearanceToOpenPanel(): void {
  if (!fileSelectorPanel) return;
  applyAppearanceToElement(fileSelectorPanel, currentAppearanceMode);
}

// 注入UI (新实现 - 使用悬浮按钮)
async function injectUI(platform: PlatformName) {

  // 清理旧实例，确保没有残留的DOM和事件监听器
  cleanupOldInstances();

  // 为所有平台动态注入 page-script 到 MAIN world
  // 原因: @crxjs/vite-plugin 不支持在 manifest 中直接配置 world: "MAIN" 的 TypeScript 文件
  if (platform === 'aliyun' || platform === 'baidu' || platform === 'quark') {
    await injectPageScriptToMainWorld(platform);
  }

  try {
    // ✅ 修复：在创建任何UI组件前，先初始化语言
    // 这确保 I18nService.currentLanguage 从 storage 加载正确的值
    const currentLang = await I18nService.getCurrentLanguage();
    logger.info(`[I18n] Content script initialized with language: ${currentLang}`);

    // 初始化外观模式（从 popup 同步到面板）
    currentAppearanceMode = await getAppearanceMode();
    applyAppearanceToOpenPanel();

    if (!stopWatchSystemColorScheme) {
      stopWatchSystemColorScheme = watchSystemColorScheme(() => {
        if (currentAppearanceMode !== 'auto') return;
        applyAppearanceToOpenPanel();
      });
    }

    // 创建平台适配器（供 File Selector Panel 使用）
    platformAdapter = createPlatformAdapter(platform);

    // 创建悬浮按钮(始终可点击,无徽章)
    floatingButton = new FloatingButton({
      onClick: handleFloatingButtonClick,
    });

    // 挂载到页面 - 等待挂载完成
    await floatingButton.mount(document.body);

    // 加载并应用当前平台的可见性状态
    await applyFloatingButtonVisibility(platform);

    // 监听存储变化
    setupStorageListener(platform);

    // 监听语言变更（同步 popup 的语言切换）
    setupLanguageChangeListener();

    logger.info('Floating button UI injected successfully');
  } catch (error) {
    logger.error('Failed to inject floating button:', error instanceof Error ? error : new Error(String(error)));

    // 重置初始化标志位，允许后续重试
    delete (window as any)[INIT_FLAG];
    initRetryCount = 0; // 重置重试计数器

    throw error; // 重新抛出错误，让上层感知失败
  }
}

/**
 * 应用悬浮按钮的可见性状态
 */
async function applyFloatingButtonVisibility(platform: PlatformName): Promise<void> {
  const storageKey = STORAGE_KEYS.VISIBILITY_PREFIX + platform;
  const isVisible = await storage.get<boolean>(storageKey);

  // 默认为显示（true）
  if (isVisible === false) {
    floatingButton?.hide();
  } else {
    floatingButton?.show();
  }
}

/**
 * 监听存储变化，同步更新按钮状态
 */
function setupStorageListener(platform: PlatformName): void {
  // 监听来自popup的消息
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'FLOATING_BUTTON_VISIBILITY_CHANGED' && message.platform === platform) {
      if (message.visible) {
        floatingButton?.show();
      } else {
        floatingButton?.hide();
      }
    }
  });

  // 也监听storage变化（备用机制）
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
      if (changes[APPEARANCE_STORAGE_KEY]) {
        const nextMode = changes[APPEARANCE_STORAGE_KEY].newValue;
        currentAppearanceMode = isAppearanceMode(nextMode) ? nextMode : DEFAULT_APPEARANCE_MODE;
        applyAppearanceToOpenPanel();
      }

      const storageKey = STORAGE_KEYS.VISIBILITY_PREFIX + platform;
      if (changes[storageKey]) {
        const newValue = changes[storageKey].newValue;
        if (newValue === false) {
          floatingButton?.hide();
        } else {
          floatingButton?.show();
        }
      }
    }
  });
}

/**
 * Force Lit-based components to re-render when language changes.
 *
 * Reason: I18nService stores language in a static field; updating it won't
 * automatically trigger LitElement re-rendering unless some reactive state changes.
 * We traverse the panel subtree (including nested shadow roots) and call
 * requestUpdate() for any element that exposes it.
 */
function requestLitRenderDeep(root: Element): void {
  const queue: Array<Element | ShadowRoot> = [root];
  const visited = new Set<Node>();

  while (queue.length) {
    const node = queue.shift();
    if (!node || visited.has(node)) continue;
    visited.add(node);

    if (node instanceof Element) {
      const maybeLit = node as unknown as { requestUpdate?: () => void; shadowRoot?: ShadowRoot | null };
      maybeLit.requestUpdate?.();

      if (maybeLit.shadowRoot) {
        queue.push(maybeLit.shadowRoot);
      }

      queue.push(...Array.from(node.children));
      continue;
    }

    // ShadowRoot (DocumentFragment)
    queue.push(...Array.from(node.children));
  }
}

/**
 * 设置语言变更监听器
 * 同步 popup 的语言切换到 content script 上下文
 */
function setupLanguageChangeListener(): void {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'LANGUAGE_CHANGED') {
      const newLanguage = (message as LanguageChangeMessage).language;

      // 核心修复：只更新本地状态，不调用 setLanguage()（避免触发通知循环）
      // 直接更新静态变量，避免再次触发 notifyLanguageChange()
      (I18nService as any).currentLanguage = newLanguage;

      // 通知 FloatingButton 更新 UI
      floatingButton?.updateLanguage();

      // ✅ 同步更新已打开的面板（以及其内部的所有 Lit 组件）
      if (fileSelectorPanel?.open) {
        requestLitRenderDeep(fileSelectorPanel);
      }

      logger.info(`Language synced successfully to: ${newLanguage}`);
    }
  });
}

// 处理悬浮按钮点击 - 打开文件选择面板
async function handleFloatingButtonClick() {
  logger.info('FloatingButton clicked, opening file selector panel');

  const platform = detectPlatform();
  if (!platform) {
    logger.warn('Unsupported platform, cannot open panel');
    return;
  }

  await ensureFileSelectorPanel(platform);
  if (fileSelectorPanel) {
    fileSelectorPanel.open = true;
  }
}

// 启动函数，供CRXJS loader调用
export function onExecute(context?: {
  perf?: { injectTime: number; loadTime: number };
}) {
  if (context?.perf) {
    // Performance metrics 可选，暂不处理
  }
  init();
}

// 移除直接调用，避免与CRXJS loader的onExecute()产生竞态条件
// CRXJS会通过onExecute()在正确的时机调用init()
// 如果直接在模块顶层调用init()，会导致双重初始化警告
// if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
//   init();
// }
