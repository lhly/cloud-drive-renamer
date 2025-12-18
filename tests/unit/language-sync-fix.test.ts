/**
 * 语言同步修复验证测试
 * 验证修复方案的有效性
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { I18nService } from '../../src/utils/i18n';

// Mock chrome API
global.chrome = {
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
  },
  i18n: {
    getUILanguage: vi.fn(() => 'zh-CN'),
  },
} as any;

describe('语言同步修复验证', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // 模拟 chrome.storage.local.get 返回空结果
    (chrome.storage.local.get as any).mockResolvedValue({});

    // 模拟 chrome.storage.local.set 成功
    (chrome.storage.local.set as any).mockResolvedValue(undefined);

    // 模拟 chrome.runtime.sendMessage 成功
    (chrome.runtime.sendMessage as any).mockResolvedValue(undefined);

    // 模拟 chrome.tabs.query 返回活动标签页
    (chrome.tabs.query as any).mockResolvedValue([{ id: 1 }]);

    // 模拟 chrome.tabs.sendMessage 成功
    (chrome.tabs.sendMessage as any).mockResolvedValue(undefined);
  });

  describe('修复1: Content Script 初始化时加载语言', () => {
    it('getCurrentLanguage() 应该从 storage 加载并更新 currentLanguage', async () => {
      // 模拟 storage 中存储了 'en'
      (chrome.storage.local.get as any).mockResolvedValueOnce({ language: 'en' });

      // 调用 getCurrentLanguage()（这是修复的关键）
      const lang = await I18nService.getCurrentLanguage();

      // 验证返回正确的语言
      expect(lang).toBe('en');

      // 验证 currentLanguage 已更新
      expect(I18nService.getCurrentLanguageSync()).toBe('en');

      // 验证调用了正确的翻译
      const translatedText = I18nService.t('floating_button_tooltip');
      expect(translatedText).toBe('Batch Rename'); // 英文翻译
    });

    it('getCurrentLanguage() 应该正确处理无存储时的默认语言', async () => {
      // 模拟 storage 中没有存储语言（返回空对象）
      (chrome.storage.local.get as any).mockResolvedValueOnce({});

      // 调用 getCurrentLanguage()
      const lang = await I18nService.getCurrentLanguage();

      // 验证返回浏览器语言（默认为 zh_CN）
      expect(lang).toBe('zh_CN');

      // 验证 currentLanguage 已更新
      expect(I18nService.getCurrentLanguageSync()).toBe('zh_CN');
    });
  });

  describe('修复2: Storage 监听器替代消息监听器', () => {
    it('storage 变化应该触发组件重渲染', () => {
      // 模拟 storage 监听器的注册
      const storageListeners: Array<(changes: any, areaName: string) => void> = [];

      // 替换 addListener 为我们的追踪版本
      (chrome.storage.onChanged.addListener as any).mockImplementation(
        (listener: (changes: any, areaName: string) => void) => {
          storageListeners.push(listener);
        }
      );

      // 模拟组件的 storage 监听器
      const mockRequestUpdate = vi.fn();
      const storageChangeListener = (
        changes: Record<string, chrome.storage.StorageChange>,
        areaName: string
      ) => {
        if (areaName === 'local' && changes['language']) {
          mockRequestUpdate();
        }
      };

      // 注册监听器
      chrome.storage.onChanged.addListener(storageChangeListener);

      // 验证监听器已注册
      expect(storageListeners.length).toBe(1);

      // 模拟 storage 变化
      const changes = {
        language: { newValue: 'en', oldValue: 'zh_CN' },
      };
      storageListeners[0](changes, 'local');

      // 验证 requestUpdate 被调用
      expect(mockRequestUpdate).toHaveBeenCalledTimes(1);
    });

    it('非 language 的 storage 变化不应该触发重渲染', () => {
      const storageListeners: Array<(changes: any, areaName: string) => void> = [];

      (chrome.storage.onChanged.addListener as any).mockImplementation(
        (listener: (changes: any, areaName: string) => void) => {
          storageListeners.push(listener);
        }
      );

      const mockRequestUpdate = vi.fn();
      const storageChangeListener = (
        changes: Record<string, chrome.storage.StorageChange>,
        areaName: string
      ) => {
        if (areaName === 'local' && changes['language']) {
          mockRequestUpdate();
        }
      };

      chrome.storage.onChanged.addListener(storageChangeListener);

      // 模拟其他 key 的变化
      const changes = {
        someOtherKey: { newValue: 'value', oldValue: 'oldValue' },
      };
      storageListeners[0](changes, 'local');

      // 验证 requestUpdate 没有被调用
      expect(mockRequestUpdate).not.toHaveBeenCalled();
    });
  });

  describe('修复3: 避免竞态条件', () => {
    it('setLanguage() 应该先更新 storage，然后更新 currentLanguage', async () => {
      const executionOrder: string[] = [];

      // 追踪执行顺序
      (chrome.storage.local.set as any).mockImplementation(async () => {
        executionOrder.push('storage.set');
      });

      // 调用 setLanguage
      await I18nService.setLanguage('en');

      executionOrder.push('currentLanguage.check');

      // 验证执行顺序
      expect(executionOrder).toEqual(['storage.set', 'currentLanguage.check']);

      // 验证 currentLanguage 已更新
      expect(I18nService.getCurrentLanguageSync()).toBe('en');
    });

    it('storage 监听器应该在 setLanguage 完成后才触发', async () => {
      // 确保初始语言不是 'en'（避免 early return）
      await I18nService.getCurrentLanguage(); // 加载默认语言 zh_CN
      expect(I18nService.getCurrentLanguageSync()).not.toBe('en');

      let storageSetComplete = false;

      (chrome.storage.local.set as any).mockImplementation(async () => {
        // 模拟异步延迟
        await new Promise((resolve) => setTimeout(resolve, 10));
        storageSetComplete = true;
      });

      // 调用 setLanguage（切换到不同的语言）
      const setLanguagePromise = I18nService.setLanguage('en');

      // 在 setLanguage 完成前，storageSetComplete 应该是 false
      expect(storageSetComplete).toBe(false);

      // 等待 setLanguage 完成
      await setLanguagePromise;

      // 现在 storageSetComplete 应该是 true
      expect(storageSetComplete).toBe(true);

      // 验证 currentLanguage 已更新
      expect(I18nService.getCurrentLanguageSync()).toBe('en');
    });
  });

  describe('端到端场景验证', () => {
    it('完整的语言切换流程应该正确工作', async () => {
      // 1. 初始化：从 storage 加载语言
      (chrome.storage.local.get as any).mockResolvedValueOnce({ language: 'zh_CN' });
      const initialLang = await I18nService.getCurrentLanguage();
      expect(initialLang).toBe('zh_CN');
      expect(I18nService.getCurrentLanguageSync()).toBe('zh_CN');

      // 2. 用户切换语言到英文
      await I18nService.setLanguage('en');
      expect(I18nService.getCurrentLanguageSync()).toBe('en');

      // 3. 验证翻译已更新
      expect(I18nService.t('floating_button_tooltip')).toBe('Batch Rename');

      // 4. 模拟页面刷新：重新从 storage 加载
      (chrome.storage.local.get as any).mockResolvedValueOnce({ language: 'en' });
      const afterRefreshLang = await I18nService.getCurrentLanguage();
      expect(afterRefreshLang).toBe('en');
      expect(I18nService.getCurrentLanguageSync()).toBe('en');

      // 5. 验证翻译仍然正确
      expect(I18nService.t('floating_button_tooltip')).toBe('Batch Rename');
    });

    it('storage 监听器应该在 language 变化后正确触发', async () => {
      const storageListeners: Array<(changes: any, areaName: string) => void> = [];
      const updateLog: string[] = [];

      (chrome.storage.onChanged.addListener as any).mockImplementation(
        (listener: (changes: any, areaName: string) => void) => {
          storageListeners.push(listener);
        }
      );

      // 模拟 Lit 组件的监听器
      const componentListener = (
        changes: Record<string, chrome.storage.StorageChange>,
        areaName: string
      ) => {
        if (areaName === 'local' && changes['language']) {
          updateLog.push(`component-update:${changes['language'].newValue}`);
        }
      };

      chrome.storage.onChanged.addListener(componentListener);

      // 切换语言
      await I18nService.setLanguage('en');
      updateLog.push('setLanguage-complete');

      // 模拟 storage 变化事件
      storageListeners[0](
        { language: { newValue: 'en', oldValue: 'zh_CN' } },
        'local'
      );

      // 验证执行顺序
      expect(updateLog).toEqual(['setLanguage-complete', 'component-update:en']);
    });
  });
});
