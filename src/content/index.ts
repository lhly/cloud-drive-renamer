import { logger } from '../utils/logger';
import { FileItem, PlatformName } from '../types/platform';
import { FloatingButton } from './components/floating-button';
import { DialogIframe } from './components/dialog-iframe';
import { RuleConfig } from '../types/rule';
import { RuleFactory } from '../rules/rule-factory';
import { QuarkAdapter } from '../adapters/quark/quark';
import { storage } from '../utils/storage';
import { PlatformUsageStats, STORAGE_KEYS } from '../types/stats';

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

// 全局初始化标志位（使用window对象实现跨执行上下文共享）
const INIT_FLAG = '__cloudDriveRenamerInitialized';

// 全局实例
let floatingButton: FloatingButton | null = null;
let dialogIframe: DialogIframe | null = null;

// 初始化重试计数器（防止无限递归）
let initRetryCount = 0;
const MAX_INIT_RETRIES = 3;

// 检测当前平台
function detectPlatform(): PlatformName | null {
  const url = window.location.href;

  if (url.includes('pan.quark.cn')) {
    return 'quark';
  } else if (url.includes('www.aliyundrive.com')) {
    return 'aliyun';
  } else if (url.includes('pan.baidu.com')) {
    return 'baidu';
  }

  return null;
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

// 注入UI (新实现 - 使用悬浮按钮)
async function injectUI(platform: PlatformName) {

  // 清理旧实例，确保没有残留的DOM和事件监听器
  cleanupOldInstances();

  try {
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
      logger.info(`Received visibility change message for ${platform}:`, message.visible);
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
        logger.info(`Storage changed for ${storageKey}:`, newValue);
        if (newValue === false) {
          floatingButton?.hide();
        } else {
          floatingButton?.show();
        }
      }
    }
  });
}

// 处理悬浮按钮点击
function handleFloatingButtonClick() {

  // 获取选中的文件
  const selectedFiles = getSelectedFiles();

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
    const adapter = new QuarkAdapter();

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

    // 5. 显示结果摘要
    logger.info('='.repeat(50));
    logger.info('='.repeat(50));

    // 6. 如果有失败的文件，显示详细信息
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
    debounceTimer = window.setTimeout(updateButton, 100);
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

  // 初始更新
  updateButton();

  // 返回清理函数
  return () => {
    observer.disconnect();
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
      '.selected-file',
      '[data-selected="true"]',
      '[class*="selected"]',
    ],
  },
  baidu: {
    selectedFiles: [
      '.wp-s-file-item--selected',
      '.file-item-checked',
      '[class*="selected"]',
    ],
  },
};

// 获取选中文件数量
function getSelectedFilesCount(): number {
  const platform = detectPlatform();

  if (!platform) {
    logger.info('[getSelectedFilesCount] No platform detected, returning 0');
    return 0;
  }

  const selectors =
    PLATFORM_SELECTORS[platform as keyof typeof PLATFORM_SELECTORS]
      ?.selectedFiles || [];

  logger.info(`[getSelectedFilesCount] Trying ${selectors.length} selectors for platform: ${platform}`);

  // 尝试每个选择器，返回第一个找到的结果
  for (const selector of selectors) {
    try {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        logger.info(
          `[getSelectedFilesCount] Found ${elements.length} selected files using selector: ${selector}`
        );
        return elements.length;
      }
    } catch (error) {
      logger.warn(`[getSelectedFilesCount] Invalid selector "${selector}":`, error);
    }
  }

  // 降级：没有找到选中文件
  return 0;
}

// 获取选中文件的详细信息（与选择器配置保持一致）
function getSelectedFiles(): FileItem[] {
  const platform = detectPlatform();

  if (!platform) {
    logger.warn('Cannot get selected files: no platform detected');
    return [];
  }

  const selectors =
    PLATFORM_SELECTORS[platform as keyof typeof PLATFORM_SELECTORS]?.selectedFiles || [];

  // 🔧 修复1：使用Map按文件ID去重，而不是按DOM元素去重
  const fileMap = new Map<string, FileItem>();

  // 🔧 修复2：优先使用 .ant-table-row-selected，只有找不到时才尝试其他选择器
  const prioritySelector = '.ant-table-row-selected';
  let candidateElements: Element[] = [];

  // 先尝试优先选择器
  const priorityElements = document.querySelectorAll(prioritySelector);
  if (priorityElements.length > 0) {
    candidateElements = Array.from(priorityElements);
  } else {
    // 降级：使用其他选择器
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

  let index = 0;

  candidateElements.forEach((el) => {
    try {
      // 关联到行元素（尽可能定位到包含数据的容器）
      const row =
        el.closest('tr') ||
        el.closest('[role="row"]') ||
        el.closest('[class*="file-item"],[class*="list-item"],[class*="row"]') ||
        el as Element;

      // 🔧 修复3：更精确的文件名提取逻辑
      // 策略1：优先使用 title 属性（最可靠）
      let filename = '';
      const titleElements = (row as Element).querySelectorAll('[title]');
      for (const titleEl of Array.from(titleElements)) {
        const title = (titleEl as HTMLElement).getAttribute('title')?.trim();
        // 过滤掉空值和明显不是文件名的title（如"选择"、"更多操作"等）
        if (title && title.length > 3 && !title.match(/^(选择|操作|更多|下载|分享|删除)$/)) {
          filename = title;
          break;
        }
      }

      // 策略2：如果没有找到合适的title，尝试更精确的选择器
      if (!filename) {
        const nameEl = (row as Element).querySelector(
          '.filename-text, [class*="filename"]:not([class*="wrapper"]), [class*="file-name"]:not([class*="wrapper"]), [class*="file-title"]'
        );

        if (nameEl) {
          // 🔧 修复4：使用 innerText 而不是 textContent（innerText 更接近用户看到的文本）
          // 或者只获取最后一个子元素的文本（通常是文件名）
          const children = nameEl.children;
          if (children.length > 0) {
            // 尝试获取最后一个子元素的文本（文件名通常在最后）
            const lastChild = children[children.length - 1] as HTMLElement;
            filename = lastChild.textContent?.trim() || '';
          }

          // 如果仍然没有，使用整个元素的 textContent 并清理
          if (!filename) {
            filename = nameEl.textContent?.trim() || '';
          }
        }
      }

      // 策略3：如果仍然没有文件名，标记为未知
      if (!filename) {
        filename = 'Unknown File';
      }

      // 🔧 修复5：清理文件名中的无关前缀
      // 移除常见的状态前缀（如"上传到同级目录"、"下载中"等）
      filename = filename.replace(/^(上传到同级目录|下载中|处理中|转码中|同步中)\s*/g, '');

      // 解析扩展名
      const lastDotIndex = filename.lastIndexOf('.');
      const ext = lastDotIndex > 0 ? filename.substring(lastDotIndex) : '';

      // 提取ID（多策略）
      const fileId =
        (row as Element).getAttribute('data-row-key') ||
        (row as Element).getAttribute('data-id') ||
        (row as Element).getAttribute('data-file-id') ||
        `unknown-${index++}`;

      // 🔧 修复6：按文件ID去重（避免重复）
      if (fileMap.has(fileId)) {
        return; // 跳过重复文件
      }

      // 父目录ID（尽力而为）
      const pathname = (row as Element).getAttribute('pathname') || '';
      const parentId = pathname.split('/').slice(-1)[0] || '';

      // 提取大小与时间（尽力匹配常见列）
      const sizeEl = (row as Element).querySelector('[class*="size"], .td-file:nth-child(2)');
      const mtimeEl = (row as Element).querySelector('[class*="time"], [class*="date"], .td-file:nth-child(3)');
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

  const files = Array.from(fileMap.values());
  return files;
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

  // 检测是否是文件大小格式（包含 KB, MB, GB, TB 等）
  if (/\d+(\.\d+)?\s*(B|KB|MB|GB|TB|PB)/i.test(timeText)) {
    // 这是文件大小，不是时间，直接返回当前时间（避免警告）
    return Date.now();
  }

  try {
    // 夸克网盘时间格式: "2025-10-13 23:17"
    // 尝试解析为Date对象
    const date = new Date(timeText.replace(' ', 'T'));

    if (isNaN(date.getTime())) {
      // 解析失败，返回当前时间
      logger.warn(`Failed to parse time: ${timeText}`);
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
  }
  init();
}

// 移除直接调用，避免与CRXJS loader的onExecute()产生竞态条件
// CRXJS会通过onExecute()在正确的时机调用init()
// 如果直接在模块顶层调用init()，会导致双重初始化警告
// if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
//   init();
// }
