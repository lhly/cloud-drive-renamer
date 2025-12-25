import { logger } from '../utils/logger';
import { FileItem, PlatformName } from '../types/platform';
import { FloatingButton } from './components/floating-button';
import { DialogIframe } from './components/dialog-iframe';
import { RuleConfig } from '../types/rule';
import { RuleFactory } from '../rules/rule-factory';
import { QuarkAdapter } from '../adapters/quark/quark';
import { BaiduAdapter } from '../adapters/baidu/baidu-adapter';
import { AliyunAdapter } from '../adapters/aliyun/aliyun-adapter';
import { storage } from '../utils/storage';
import { PlatformUsageStats, STORAGE_KEYS } from '../types/stats';
import { I18nService } from '../utils/i18n';
import type { LanguageChangeMessage } from '../types/i18n';
import { detectPlatformFromUrl, isQuarkShareLink, isAliyunShareLink } from '../utils/platform-detector';

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
let dialogIframe: DialogIframe | null = null;

// 初始化重试计数器（防止无限递归）
let initRetryCount = 0;
const MAX_INIT_RETRIES = 3;

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

  // 清理旧的对话框实例
  if (dialogIframe) {
    try {
      dialogIframe.close();
    } catch (error) {
      logger.error('Failed to close old dialog iframe:', error instanceof Error ? error : new Error(String(error)));
    }
    dialogIframe = null;
  }

  // 额外保护：手动移除可能残留的DOM元素（Shadow DOM宿主）
  const existingShadowHost = document.querySelector('#cloud-drive-renamer-shadow-host');
  if (existingShadowHost) {
    existingShadowHost.remove();
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
  try {
    // ✅ 引用编译后的 .js 文件（Vite 会将 TypeScript 编译为 JavaScript）
    const scriptPath = `src/adapters/${platform}/page-script.js`;
    const scriptURL = chrome.runtime.getURL(scriptPath);

    // 创建 script 标签并注入到页面 (MAIN world)
    const script = document.createElement('script');
    script.src = scriptURL;
    script.type = 'module'; // 支持 ES6 模块

    // 等待脚本加载完成
    await new Promise<void>((resolve, reject) => {
      script.onload = () => {
        resolve();
      };
      script.onerror = () => {
        reject(new Error(`Failed to load page-script for ${platform}`));
      };

      // 注入到页面
      (document.head || document.documentElement).appendChild(script);
    });

    // 脚本加载后可以移除标签 (代码已执行)
    script.remove();

    logger.info(`${platform} page-script injected to MAIN world successfully`);
  } catch (error) {
    logger.error(`Failed to inject ${platform} page-script:`, error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
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

    // 创建悬浮按钮
    floatingButton = new FloatingButton({
      onClick: handleFloatingButtonClick,
      onBadgeUpdate: () => {
      },
    });

    // 挂载到页面 - 等待挂载完成
    await floatingButton.mount(document.body);

    // 立即同步初始状态,确保 buttonCount 正确反映已选中文件数
    const initialCount = getSelectedFilesCount();
    floatingButton.updateBadge(initialCount);

    // 加载并应用当前平台的可见性状态
    await applyFloatingButtonVisibility(platform);

    // 创建 DialogIframe 实例
    dialogIframe = new DialogIframe({
      onConfirm: handleDialogConfirm,
      onClose: handleDialogClose,
    });

    // 开始监听文件选择
    watchFileSelection();

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

      logger.info(`Language synced successfully to: ${newLanguage}`);
    }
  });
}

// 处理悬浮按钮点击（方案A：改为异步以支持阿里云盘）
async function handleFloatingButtonClick() {
  // 获取选中的文件（异步调用以支持阿里云盘）
  const selectedFiles = await getSelectedFiles();

  if (selectedFiles.length === 0) {
    logger.warn('No files selected');
    return;
  }

  // 打开对话框
  dialogIframe?.open(selectedFiles);
}

// 处理对话框确认
async function handleDialogConfirm(ruleConfig: RuleConfig, files: FileItem[]) {

  if (files.length === 0) {
    logger.warn('No files to rename');
    return;
  }

  // 获取当前平台（用于统计数据保存）
  const platform = detectPlatform();

  try {
    // 1. 创建适配器实例
    let adapter;
    if (platform === 'quark') {
      adapter = new QuarkAdapter();
    } else if (platform === 'baidu') {
      adapter = new BaiduAdapter();
    } else if (platform === 'aliyun') {
      adapter = new AliyunAdapter();
    } else {
      throw new Error(`不支持的平台: ${platform}`);
    }

    // 2. 创建规则执行器
    const rule = RuleFactory.create(ruleConfig);

    // 3. 批量重命名
    let successCount = 0;
    let failCount = 0;
    const results: Array<{ file: FileItem; success: boolean; error?: Error }> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      try {
        // 应用规则生成新文件名
        const newName = rule.execute(file.name, i, files.length);

        // 如果文件名没有变化，跳过
        if (newName === file.name) {
          results.push({ file, success: true });
          continue;
        }

        // 执行重命名
        const result = await adapter.renameFile(file.id, newName);

        if (result.success) {
          successCount++;
          results.push({ file, success: true });
        } else {
          logger.error(`[${i + 1}/${files.length}] Failed: "${file.name}"`, result.error);
          failCount++;
          results.push({ file, success: false, error: result.error });
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error(`[${i + 1}/${files.length}] Exception: "${file.name}"`, err);
        failCount++;
        results.push({
          file,
          success: false,
          error: err
        });
      }
    }

    // 4. 保存统计数据（累加方式）
    if (platform) {
      await updateUsageStats(platform, successCount, failCount);
    }

    // 5. 如果有失败的文件，显示详细信息
    if (failCount > 0) {
      logger.warn('Failed files:');
      results.filter(r => !r.success).forEach((r, idx) => {
        logger.warn(`  ${idx + 1}. ${r.file.name}: ${r.error?.message || 'Unknown error'}`);
      });
    }

    // 7. 刷新页面以显示新文件名（可选）
    if (successCount > 0) {
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Fatal error during rename operation:', err);
    throw err;
  }
}

// 处理对话框关闭
function handleDialogClose() {
}

/**
 * 更新使用统计数据（累加方式）
 * @param platform 平台名称
 * @param successCount 本次成功次数
 * @param failCount 本次失败次数
 */
async function updateUsageStats(
  platform: PlatformName,
  successCount: number,
  failCount: number
): Promise<void> {
  try {
    const storageKey = STORAGE_KEYS.USAGE_STATS_PREFIX + platform;

    // 读取现有统计数据
    const existingStats = await storage.get<PlatformUsageStats>(storageKey);

    // 累加计数
    const newStats: PlatformUsageStats = {
      platform,
      successCount: (existingStats?.successCount || 0) + successCount,
      failedCount: (existingStats?.failedCount || 0) + failCount,
      lastUpdated: Date.now(),
    };

    // 保存到存储
    await storage.set(storageKey, newStats);

    logger.info(
      `Stats updated for ${platform}: +${successCount} success, +${failCount} failed | Total: ${newStats.successCount} success, ${newStats.failedCount} failed`
    );
  } catch (error) {
    logger.error('Failed to update usage stats:', error instanceof Error ? error : new Error(String(error)));
  }
}

// 监听文件选择 (重构版)
function watchFileSelection(): () => void {
  let lastSelectedCount = 0;
  let debounceTimer: number | null = null;

  const updateButton = () => {
    const selectedCount = getSelectedFilesCount();

    // 只有数量变化时才更新
    if (selectedCount !== lastSelectedCount) {
      lastSelectedCount = selectedCount;
      // 更新悬浮按钮徽章
      floatingButton?.updateBadge(selectedCount);
    }
  };

  const debouncedUpdate = () => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = window.setTimeout(() => {
      updateButton();
    }, 100); // 百度网盘使用change事件监听，恢复标准100ms延迟
  };

  // 使用MutationObserver监听DOM变化
  const observer = new MutationObserver(debouncedUpdate);

  // 优化：优先监听文件列表容器，而不是整个body
  const targetNode =
    document.querySelector('[class*="file-list"]') ||
    document.querySelector('[class*="list-view"]') ||
    document.querySelector('.ant-table-wrapper') ||
    document.querySelector('#app') ||
    document.body;


  // 监听class属性变化，因为Ant Design通过class变化来标记选中状态
  observer.observe(targetNode, {
    attributes: true, // 必须监听属性变化以捕获class变化
    attributeFilter: ['class'], // 只监听class属性，避免性能问题
    childList: true,
    subtree: true,
  });

  // 针对百度网盘：添加原生change事件监听作为备用方案
  // 根因：百度网盘的checkbox变化不会触发class属性的mutation
  // 解决方案：监听原生change事件（诊断确认change事件正常触发）
  const changeListener = (e: Event) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' &&
        (target as HTMLInputElement).type === 'checkbox' &&
        target.closest('tbody')) {
      debouncedUpdate();
    }
  };
  document.addEventListener('change', changeListener, true); // 使用捕获阶段确保能监听到所有checkbox变化

  // 初始更新
  updateButton();

  // 返回清理函数
  return () => {
    observer.disconnect();
    document.removeEventListener('change', changeListener, true);
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  };
}

// 平台选择器配置
const PLATFORM_SELECTORS = {
  quark: {
    // 夸克网盘使用Ant Design组件
    selectedFiles: [
      // ✅ 优先使用Ant Design Table选中行 - 直接包含文件信息
      '.ant-table-row-selected',
      '[class*="ant-table"] [class*="selected"]',
      // Ant Design勾选的checkbox（备选）
      '.ant-checkbox-wrapper-checked',
      // 选中的文件行（多种可能的类名）
      '[class*="file-list"] [class*="selected"]',
      '[class*="list-view"] .is-selected',
      '[class*="file-item"][class*="selected"]',
      // 通用选中状态
      '[data-selected="true"]',
      '[aria-selected="true"]',
    ],
  },
  aliyun: {
    selectedFiles: [
      // ✅ 根本修复：只使用精确的选择器，避免过于宽泛的通用选择器 (2025-12-23)
      // 阿里云盘使用 data-is-selected 属性标识选中的行
      // 移除了以下宽泛选择器以防止匹配非文件行（如表头全选框）：
      // - 'input[type="checkbox"]:checked' （会匹配所有选中的checkbox，包括表头）
      // - '[class*="checkbox"][data-checked="true"]' （过于宽泛）
      '[data-is-selected="true"]',
      '[class*="tr--"][data-is-selected="true"]',
      '.tr--Ogi-3[data-is-selected="true"]',
      '.tr--97U9T[data-is-selected="true"]',
      // 只保留带选中状态过滤的特定复选框选择器
      '.checkbox--GfceW[data-checked="true"]',
      '.checkbox--P-zHa[data-checked="true"]',
    ],
  },
  baidu: {
    selectedFiles: [
      // ✅ 正确的选择器 - 基于实际DOM分析 (2025-12-19)
      // 百度网盘使用 is-checked 类标识选中的checkbox
      // 限定在 tbody 范围内，避免匹配表头的全选checkbox
      'tbody label.u-checkbox.is-checked',
      'tbody .u-checkbox.is-checked',
      'tbody .u-checkbox__input.is-checked',
    ],
  },
};

// 获取选中文件数量
function getSelectedFilesCount(): number {
  const platform = detectPlatform();

  if (!platform) {
    return 0;
  }

  const selectors =
    PLATFORM_SELECTORS[platform as keyof typeof PLATFORM_SELECTORS]
      ?.selectedFiles || [];

  // 尝试每个选择器，返回第一个找到的结果
  for (const selector of selectors) {
    try {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        return elements.length;
      }
    } catch (error) {
      logger.warn(`Invalid selector "${selector}":`, error);
    }
  }

  // 降级：没有找到选中文件
  return 0;
}

/**
 * 验证行元素是否是有效的文件行（防御层）
 * @param row - 待验证的行元素
 * @param platform - 平台名称（可选，用于平台特定验证）
 * @returns 是否为有效文件行
 */
function isValidFileRow(row: Element, platform?: string): boolean {
  // 必须包含文件名元素
  const hasFilename = row.querySelector('[title], .filename-text, [class*="filename"]');

  // 阿里云盘特殊处理：只验证文件名，ID从API缓存获取
  if (platform === 'aliyun') {
    return !!hasFilename;
  }

  // 其他平台：需要DOM有ID属性
  const fileId = row.getAttribute('data-row-key') ||
                 row.getAttribute('data-id') ||
                 row.getAttribute('data-file-id');

  return !!(hasFilename && fileId && !fileId.startsWith('unknown-'));
}

/**
 * Quark平台专用的文件提取逻辑
 */
function getSelectedFilesForQuark(): FileItem[] {
  const selectors = PLATFORM_SELECTORS.quark.selectedFiles;
  const fileMap = new Map<string, FileItem>();

  // 优先使用 .ant-table-row-selected，只有找不到时才尝试其他选择器
  const prioritySelector = '.ant-table-row-selected';
  let candidateElements: Element[] = [];

  const priorityElements = document.querySelectorAll(prioritySelector);
  if (priorityElements.length > 0) {
    candidateElements = Array.from(priorityElements);
  } else {
    const candidateSet = new Set<Element>();
    for (const selector of selectors) {
      try {
        document.querySelectorAll(selector).forEach((el) => candidateSet.add(el));
      } catch (error) {
        logger.warn(`Invalid selector "${selector}" while collecting files:`, error);
      }
    }
    candidateElements = Array.from(candidateSet);
  }

  if (candidateElements.length === 0) {
    logger.warn('No selected elements found when collecting files');
    return [];
  }

  candidateElements.forEach((el) => {
    try {
      const row =
        el.closest('tr') ||
        el.closest('[role="row"]') ||
        el.closest('[class*="file-item"],[class*="list-item"],[class*="row"]') ||
        el as Element;

      // 验证行有效性（防御层 - Quark平台）
      if (!isValidFileRow(row, 'quark')) {
        logger.warn('Skipping invalid file row (no filename or invalid ID)');
        return;
      }

      // 提取文件名
      let filename = '';
      const titleElements = (row as Element).querySelectorAll('[title]');
      for (const titleEl of Array.from(titleElements)) {
        const title = (titleEl as HTMLElement).getAttribute('title')?.trim();
        if (title && title.length > 3 && !title.match(/^(选择|操作|更多|下载|分享|删除)$/)) {
          filename = title;
          break;
        }
      }

      if (!filename) {
        const nameEl = (row as Element).querySelector(
          '.filename-text, [class*="filename"]:not([class*="wrapper"]), [class*="file-name"]:not([class*="wrapper"]), [class*="file-title"]'
        );

        if (nameEl) {
          const children = nameEl.children;
          if (children.length > 0) {
            const lastChild = children[children.length - 1] as HTMLElement;
            filename = lastChild.textContent?.trim() || '';
          }

          if (!filename) {
            filename = nameEl.textContent?.trim() || '';
          }
        }
      }

      // 如果仍然没有文件名，跳过此元素（防御加固）
      if (!filename) {
        logger.warn('Failed to extract filename, skipping element');
        return;
      }

      // 清理文件名中的无关前缀
      filename = filename.replace(/^(上传到同级目录|下载中|处理中|转码中|同步中)\s*/g, '');

      // 解析扩展名
      const lastDotIndex = filename.lastIndexOf('.');
      const ext = lastDotIndex > 0 ? filename.substring(lastDotIndex) : '';

      // 提取ID
      const fileId =
        (row as Element).getAttribute('data-row-key') ||
        (row as Element).getAttribute('data-id') ||
        (row as Element).getAttribute('data-file-id') ||
        '';

      // 再次验证ID有效性
      if (!fileId || fileId.startsWith('unknown-')) {
        logger.warn('Invalid file ID, skipping element');
        return;
      }

      // 按文件ID去重
      if (fileMap.has(fileId)) {
        return;
      }

      // 父目录ID
      const pathname = (row as Element).getAttribute('pathname') || '';
      const parentId = pathname.split('/').slice(-1)[0] || '';

      // 提取大小与时间
      const sizeEl = (row as Element).querySelector('td[class*="size"], td.td-file:nth-child(2)');
      const mtimeEl = (row as Element).querySelector(
        'td[class*="modify-time"], td[class*="mtime"], td[class*="update-time"], td.td-file:nth-child(3):not(:has(button)):not(:has(a))'
      );

      const sizeText = (sizeEl as HTMLElement)?.textContent?.trim() || '0';
      const mtimeText = (mtimeEl as HTMLElement)?.textContent?.trim() || '';

      const fileItem: FileItem = {
        id: fileId,
        name: filename,
        ext,
        parentId,
        size: parseFileSize(sizeText),
        mtime: parseModificationTime(mtimeText),
      };

      fileMap.set(fileId, fileItem);
    } catch (error) {
      logger.error('Failed to extract file info from selected element:', error instanceof Error ? error : new Error(String(error)));
    }
  });

  return Array.from(fileMap.values());
}

/**
 * Aliyun平台专用的文件提取逻辑（方案A：根治方案）
 *
 * 策略：直接调用 AliyunAdapter.getSelectedFiles() 获取真实 file_id
 * 优势：
 * - 使用真实 file_id，避免文件名歧义
 * - 简化代码，减少97行DOM解析逻辑
 * - 与夸克/百度架构一致
 */
async function getSelectedFilesForAliyun(): Promise<FileItem[]> {
  try {
    // 直接调用 AliyunAdapter.getSelectedFiles()
    const { AliyunAdapter } = await import('../adapters/aliyun/aliyun-adapter');
    const adapter = new AliyunAdapter();
    const files = await adapter.getSelectedFiles(); // ✅ 返回真实 file_id

    logger.info(`Retrieved ${files.length} selected files from AliyunAdapter`);
    return files;
  } catch (error) {
    logger.error('Failed to get selected files for Aliyun platform:', error instanceof Error ? error : new Error(String(error)));

    // 降级：使用DOM解析
    logger.warn('Falling back to DOM parsing...');
    return await getSelectedFilesFromDOMForAliyun(); // 添加 await
  }
}

/**
 * Helper function: Build class selector with fallback to tagName
 * Prevents SyntaxError when classList is empty
 * @param element - DOM element
 * @returns Valid CSS selector prefix (either .class1.class2 or tagname)
 */
function buildClassSelector(element: Element): string {
  const classes = Array.from(element.classList);
  if (classes.length > 0) {
    return '.' + classes.slice(0, 2).join('.');
  }
  return element.tagName.toLowerCase();
}

/**
 * 生成唯一的 CSS selector 用于定位元素
 * @param element - DOM 元素
 * @returns CSS selector 字符串
 */
function getUniqueSelector(element: Element): string {
  // 优先级1: 使用 data-row-key (阿里云盘的唯一文件ID)
  const rowKey = element.getAttribute('data-row-key');
  if (rowKey) {
    const classSelector = buildClassSelector(element);
    const selector = `${classSelector}[data-row-key="${rowKey}"]`;
    return selector;
  }

  // 优先级2: 使用其他唯一 data 属性
  const dataId = element.getAttribute('data-id') || element.getAttribute('data-file-id');
  if (dataId) {
    const classSelector = buildClassSelector(element);
    const attrName = element.hasAttribute('data-id') ? 'data-id' : 'data-file-id';
    const selector = `${classSelector}[${attrName}="${dataId}"]`;
    return selector;
  }

  // 优先级3: 结合 data-is-selected + 容器级索引
  if (element.hasAttribute('data-is-selected')) {
    const elementClasses = Array.from(element.classList);
    const tagName = element.tagName.toLowerCase();

    // 向上查找包含多个选中元素的容器
    let container: Element | null = element.parentElement;
    let containerLevel = 0;
    let containerIndex = 1; // 默认使用1，如果找不到容器
    let foundContainer: Element | null = null;

    while (container && containerLevel < 5) {
      const selectedInContainer = container.querySelectorAll(`${tagName}[data-is-selected="true"]`);

      if (selectedInContainer.length > 1) {
        // ✅ 找到包含多个选中元素的容器
        foundContainer = container;
        const allSelectedSameTag = Array.from(selectedInContainer);
        containerIndex = allSelectedSameTag.indexOf(element) + 1;
        break;
      }

      container = container.parentElement;
      containerLevel++;
    }

    // 构建基于容器的唯一选择器
    // 策略：使用容器类名 + nth-child来定位包装元素 + 最终元素的类名和属性
    if (foundContainer && containerIndex > 0) {
      // 找到容器的第一层子元素(通常是drag-wrapper)
      let directChild: Element | null = element;
      while (directChild && directChild.parentElement !== foundContainer) {
        directChild = directChild.parentElement;
      }

      if (directChild) {
        // 获取容器的标识符(优先类名，回退到标签名)
        const containerClasses = Array.from(foundContainer.classList);
        const containerIdentifier = containerClasses.length > 0
          ? containerClasses.slice(0, 2).join('.')
          : foundContainer.tagName.toLowerCase();

        // 计算direct child在容器中的位置
        const containerChildren = Array.from(foundContainer.children);
        const childIndex = containerChildren.indexOf(directChild) + 1;

        // 构建选择器: 容器 > 第N个子元素 后代元素[属性]
        // 根据containerIdentifier的形式决定是否添加点前缀
        const containerPrefix = containerClasses.length > 0 ? `.${containerIdentifier}` : containerIdentifier;

        // ✅ FIX: Handle empty element classList
        const elementPart = elementClasses.length > 0
          ? `${tagName}.${elementClasses.slice(0, 2).join('.')}[data-is-selected="${element.getAttribute('data-is-selected')}"]`
          : `${tagName}[data-is-selected="${element.getAttribute('data-is-selected')}"]`;

        const selector = `${containerPrefix} > *:nth-child(${childIndex}) ${elementPart}`;

        // 验证选择器语法有效性
        try {
          document.querySelector(selector);
        } catch (e) {
          // 回退到fallback策略
          const fallbackClassSelector = elementClasses.length > 0
            ? '.' + elementClasses.slice(0, 2).join('.')
            : tagName;
          const fallbackSelector = `${fallbackClassSelector}[data-is-selected="${element.getAttribute('data-is-selected')}"]:nth-of-type(1)`;
          return fallbackSelector;
        }

        return selector;
      }
    }

    // 回退：如果没有找到容器或只有1个元素，使用原来的方式
    const fallbackClassSelector = elementClasses.length > 0
      ? '.' + elementClasses.slice(0, 2).join('.')
      : tagName;
    const selector = `${fallbackClassSelector}[data-is-selected="${element.getAttribute('data-is-selected')}"]:nth-of-type(1)`;
    return selector;
  }

  // 回退: 纯位置索引
  const classes = Array.from(element.classList);
  const tagName = element.tagName.toLowerCase();

  // ✅ 关键修复：只计数同标签类型的兄弟元素
  const siblings = Array.from(element.parentElement?.children || [])
    .filter(child => child.tagName.toLowerCase() === tagName);

  const index = siblings.indexOf(element) + 1;

  // ✅ FIX: Handle empty classList in fallback path
  const selector = classes.length > 0
    ? `.${classes.slice(0, 2).join('.')}:nth-of-type(${index})`
    : `${tagName}:nth-of-type(${index})`;

  return selector;
}

/**
 * 从 React Fiber 树提取文件元数据（通过 page script）
 *
 * **重要**: 这个函数运行在 ISOLATED world (content script)
 * 由于 Chrome 的安全隔离机制，无法直接访问 React Fiber 的非可枚举属性
 * 因此必须通过 postMessage 请求 MAIN world (page script) 提取数据
 *
 * @param element - DOM 元素
 * @returns 包含 driveId 和 fileId 的对象，如果未找到则返回 null
 */
async function extractFileDataFromReactFiber(element: Element): Promise<{ driveId: string; fileId: string } | null> {
  try {
    // 生成唯一 selector
    const selector = getUniqueSelector(element);

    // 验证 selector 可用性和唯一性
    const testElement = document.querySelector(selector);

    // ✅ 关键验证：确保 selector 唯一标识元素
    if (testElement !== element) {
      return null;
    }

    // 生成唯一 requestId
    const requestId = `fiber-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // 发送请求到 page script (MAIN world)
    window.postMessage({
      type: 'EXTRACT_REACT_FIBER_REQUEST',
      requestId,
      selector,
    }, '*');

    // 等待响应（带超时）
    const TIMEOUT_MS = 5000; // 5秒超时

    const result = await Promise.race([
      // Promise 1: 等待响应
      new Promise<{ driveId: string; fileId: string } | null>((resolve) => {
        const messageHandler = (event: MessageEvent) => {
          if (event.source !== window) return;

          const message = event.data;

          // 检查是否是我们的响应
          if (message.type === 'EXTRACT_REACT_FIBER_RESPONSE' && message.requestId === requestId) {
            window.removeEventListener('message', messageHandler);

            if (message.success && message.data) {
              resolve(message.data);
            } else {
              resolve(null);
            }
          }
        };

        window.addEventListener('message', messageHandler);
      }),

      // Promise 2: 超时处理
      new Promise<null>((resolve) => {
        setTimeout(() => {
          resolve(null);
        }, TIMEOUT_MS);
      })
    ]);

    return result;

  } catch (error) {
    logger.error('Exception in extractFileDataFromReactFiber:', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * 从DOM解析阿里云盘选中的文件（回退方案）
 * 改进：优先从 React Fiber 树提取 driveId 和 fileId
 */
async function getSelectedFilesFromDOMForAliyun(): Promise<FileItem[]> {
  const fileMap = new Map<string, FileItem>();

  const selectedRows = document.querySelectorAll('[data-is-selected="true"]');

  if (selectedRows.length === 0) {
    logger.warn('No selected elements found for Aliyun platform (DOM fallback)');
    return [];
  }

  // 使用 for...of 代替 forEach 以支持 await
  for (const row of Array.from(selectedRows)) {
    try {
      // 验证行有效性
      if (!isValidFileRow(row, 'aliyun')) {
        continue; // 使用 continue 代替 return
      }

      // 提取文件名
      let filename = '';

      // 策略1：优先使用 title 属性
      const titleElements = row.querySelectorAll('[title]');
      for (const titleEl of Array.from(titleElements)) {
        const title = (titleEl as HTMLElement).getAttribute('title')?.trim();
        if (title && title.length > 3 && !title.match(/^(选择|操作|更多|下载|分享|删除)$/)) {
          filename = title;
          break;
        }
      }

      // 策略2：尝试更精确的选择器
      if (!filename) {
        const nameEl = row.querySelector(
          '.filename-text, [class*="filename"]:not([class*="wrapper"]), [class*="file-name"]:not([class*="wrapper"]), [class*="file-title"]'
        );

        if (nameEl) {
          const children = nameEl.children;
          if (children.length > 0) {
            const lastChild = children[children.length - 1] as HTMLElement;
            filename = lastChild.textContent?.trim() || '';
          }

          if (!filename) {
            filename = nameEl.textContent?.trim() || '';
          }
        }
      }

      if (!filename) {
        continue; // 使用 continue 代替 return
      }

      // 清理文件名
      filename = filename.replace(/^(上传到同级目录|下载中|处理中|转码中|同步中)\s*/g, '');

      // 解析扩展名
      const lastDotIndex = filename.lastIndexOf('.');
      const ext = lastDotIndex > 0 ? filename.substring(lastDotIndex) : '';

      // ✅ 优先从 React Fiber 树提取真实的 driveId 和 fileId
      const fiberData = await extractFileDataFromReactFiber(row); // 添加 await

      let fileId: string;

      if (fiberData) {
        // 成功提取：使用 driveId:fileId 格式编码真实ID
        fileId = `${fiberData.driveId}:${fiberData.fileId}`;
      } else {
        // 回退：使用文件名作为临时ID
        fileId = filename;
        logger.warn(`Fiber extraction failed for element, using filename as ID: ${filename}`);
      }

      if (fileMap.has(fileId)) {
        continue; // 使用 continue 代替 return
      }

      // 父目录ID
      const pathname = row.getAttribute('pathname') || '';
      const parentId = pathname.split('/').slice(-1)[0] || '';

      // 提取大小与时间
      const sizeEl = row.querySelector('td[class*="size"], [class*="size"]');
      const mtimeEl = row.querySelector(
        'td[class*="modify-time"], td[class*="mtime"], td[class*="update-time"], [class*="modify-time"]'
      );

      const sizeText = (sizeEl as HTMLElement)?.textContent?.trim() || '0';
      const mtimeText = (mtimeEl as HTMLElement)?.textContent?.trim() || '';

      const fileItem: FileItem = {
        id: fileId,
        name: filename,
        ext,
        parentId,
        size: parseFileSize(sizeText),
        mtime: parseModificationTime(mtimeText),
      };

      fileMap.set(fileId, fileItem);
    } catch (error) {
      logger.error('Failed to extract file info from DOM:', error instanceof Error ? error : new Error(String(error)));
    }
  } // 结束 for...of 循环

  const result = Array.from(fileMap.values());

  logger.info(`Extracted ${fileMap.size} files from DOM (fallback mode)`);
  return result;
}

/**
 * Baidu平台专用的文件提取逻辑
 */
function getSelectedFilesForBaidu(): FileItem[] {
  const selectors = PLATFORM_SELECTORS.baidu.selectedFiles;
  const fileMap = new Map<string, FileItem>();
  const candidateSet = new Set<Element>();

  for (const selector of selectors) {
    try {
      document.querySelectorAll(selector).forEach((el) => candidateSet.add(el));
    } catch (error) {
      logger.warn(`Invalid selector "${selector}" while collecting files:`, error);
    }
  }

  const candidateElements = Array.from(candidateSet);

  if (candidateElements.length === 0) {
    logger.warn('No selected elements found for Baidu platform');
    return [];
  }

  candidateElements.forEach((el) => {
    try {
      const row =
        el.closest('tr') ||
        el.closest('[role="row"]') ||
        el.closest('[class*="file-item"],[class*="list-item"],[class*="row"]') ||
        el as Element;

      // 验证行有效性（防御层 - Baidu平台）
      if (!isValidFileRow(row, 'baidu')) {
        logger.warn('Skipping invalid file row (no filename or invalid ID)');
        return;
      }

      // 提取文件名
      let filename = '';
      const titleElements = (row as Element).querySelectorAll('[title]');
      for (const titleEl of Array.from(titleElements)) {
        const title = (titleEl as HTMLElement).getAttribute('title')?.trim();
        if (title && title.length > 3 && !title.match(/^(选择|操作|更多|下载|分享|删除)$/)) {
          filename = title;
          break;
        }
      }

      if (!filename) {
        const nameEl = (row as Element).querySelector(
          '.filename-text, [class*="filename"]:not([class*="wrapper"]), [class*="file-name"]:not([class*="wrapper"]), [class*="file-title"]'
        );

        if (nameEl) {
          const children = nameEl.children;
          if (children.length > 0) {
            const lastChild = children[children.length - 1] as HTMLElement;
            filename = lastChild.textContent?.trim() || '';
          }

          if (!filename) {
            filename = nameEl.textContent?.trim() || '';
          }
        }
      }

      // 如果仍然没有文件名，跳过此元素（防御加固）
      if (!filename) {
        logger.warn('Failed to extract filename, skipping element');
        return;
      }

      // 清理文件名
      filename = filename.replace(/^(上传到同级目录|下载中|处理中|转码中|同步中)\s*/g, '');

      // 解析扩展名
      const lastDotIndex = filename.lastIndexOf('.');
      const ext = lastDotIndex > 0 ? filename.substring(lastDotIndex) : '';

      // 提取ID
      const fileId =
        (row as Element).getAttribute('data-row-key') ||
        (row as Element).getAttribute('data-id') ||
        (row as Element).getAttribute('data-file-id') ||
        '';

      // 验证ID有效性
      if (!fileId || fileId.startsWith('unknown-')) {
        logger.warn('Invalid file ID, skipping element');
        return;
      }

      // 按文件ID去重
      if (fileMap.has(fileId)) {
        return;
      }

      // 父目录ID
      const pathname = (row as Element).getAttribute('pathname') || '';
      const parentId = pathname.split('/').slice(-1)[0] || '';

      // 提取大小与时间
      const sizeEl = (row as Element).querySelector('td[class*="size"], td.td-file:nth-child(2)');
      const mtimeEl = (row as Element).querySelector(
        'td[class*="modify-time"], td[class*="mtime"], td[class*="update-time"], td.td-file:nth-child(3):not(:has(button)):not(:has(a))'
      );

      const sizeText = (sizeEl as HTMLElement)?.textContent?.trim() || '0';
      const mtimeText = (mtimeEl as HTMLElement)?.textContent?.trim() || '';

      const fileItem: FileItem = {
        id: fileId,
        name: filename,
        ext,
        parentId,
        size: parseFileSize(sizeText),
        mtime: parseModificationTime(mtimeText),
      };

      fileMap.set(fileId, fileItem);
    } catch (error) {
      logger.error('Failed to extract file info from selected element:', error instanceof Error ? error : new Error(String(error)));
    }
  });

  return Array.from(fileMap.values());
}

/**
 * 获取选中文件的详细信息（架构层 - 根据平台分发）
 *
 * 修复说明：改为异步函数以支持阿里云盘平台的异步文件获取（方案A）
 */
async function getSelectedFiles(): Promise<FileItem[]> {
  const platform = detectPlatform();

  if (!platform) {
    logger.warn('Cannot get selected files: no platform detected');
    return [];
  }

  // 根据平台调用专用处理函数
  switch (platform) {
    case 'quark':
      return getSelectedFilesForQuark();
    case 'aliyun':
      return await getSelectedFilesForAliyun(); // ✅ 异步调用
    case 'baidu':
      return getSelectedFilesForBaidu();
    default:
      logger.warn(`Unsupported platform: ${platform}`);
      return [];
  }
}

// 解析文件大小字符串为字节数
function parseFileSize(sizeText: string): number {
  const match = sizeText.match(/([\d.]+)\s*([KMGT]?B?)/i);

  if (!match) {
    return 0;
  }

  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();

  const multipliers: Record<string, number> = {
    'B': 1,
    'KB': 1024,
    'MB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024,
    'TB': 1024 * 1024 * 1024 * 1024,
    'K': 1024,
    'M': 1024 * 1024,
    'G': 1024 * 1024 * 1024,
    'T': 1024 * 1024 * 1024 * 1024,
  };

  return Math.floor(value * (multipliers[unit] || 1));
}

// 解析修改时间字符串为时间戳
function parseModificationTime(timeText: string): number {
  if (!timeText) {
    return Date.now();
  }

  // 过滤明显不是时间的内容
  // 1. 检测是否是文件大小格式（包含 KB, MB, GB, TB 等）
  if (/\d+(\.\d+)?\s*(B|KB|MB|GB|TB|PB)/i.test(timeText)) {
    // 这是文件大小，不是时间，直接返回当前时间（避免警告）
    return Date.now();
  }

  // 2. 检测是否是操作菜单文本（包含常见操作关键词）
  const menuKeywords = /^(重命名|复制|移动|删除|下载|分享|导出|导入|上传|更多|操作|选择|-+|[\u4e00-\u9fa5]{2,}[\s\u4e00-\u9fa5]*)+$/;
  if (menuKeywords.test(timeText.trim())) {
    // 这是菜单文本，不是时间，不输出警告
    return Date.now();
  }

  // 3. 过滤纯符号或过短的文本
  if (timeText.length < 4 || /^[-\s]+$/.test(timeText)) {
    return Date.now();
  }

  try {
    // 夸克网盘时间格式: "2025-10-13 23:17"
    // 尝试解析为Date对象
    const date = new Date(timeText.replace(' ', 'T'));

    if (isNaN(date.getTime())) {
      // 解析失败，返回当前时间
      // 降级为debug日志，因为已经过滤了大部分非时间文本
      logger.debug(`Failed to parse time: ${timeText}`);
      return Date.now();
    }

    return date.getTime();
  } catch (error) {
    logger.error('Error parsing modification time:', error instanceof Error ? error : new Error(String(error)));
    return Date.now();
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
