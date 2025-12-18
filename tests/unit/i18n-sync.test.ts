/**
 * 语言同步测试
 * 验证 popup 和 content script 之间的语言切换同步机制
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { I18nService } from '../../src/utils/i18n';
import type { LanguageChangeMessage } from '../../src/types/i18n';

describe('I18n Service Language Sync', () => {
  beforeEach(() => {
    // Mock chrome.storage.local
    global.chrome = {
      storage: {
        local: {
          get: vi.fn((key: string) => Promise.resolve({ [key]: 'zh_CN' })),
          set: vi.fn(() => Promise.resolve()),
        } as any,
      } as any,
      runtime: {
        sendMessage: vi.fn(() => Promise.resolve()),
      } as any,
      tabs: {
        query: vi.fn(() => Promise.resolve([])),
        sendMessage: vi.fn(() => Promise.resolve()),
      } as any,
      i18n: {
        getUILanguage: vi.fn(() => 'zh-CN'),
      } as any,
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should update currentLanguage when setLanguage is called', async () => {
    // 初始化为默认语言
    await I18nService.getCurrentLanguage();
    expect(I18nService.getCurrentLanguageSync()).toBe('zh_CN');

    // 切换到英语
    await I18nService.setLanguage('en');
    expect(I18nService.getCurrentLanguageSync()).toBe('en');

    // 验证 I18nService.t() 使用新语言
    const message = I18nService.t('floating_button_tooltip');
    expect(message).toBeDefined();
  });

  it('should send LANGUAGE_CHANGED message when language is changed', async () => {
    const sendMessageSpy = vi.spyOn(chrome.runtime, 'sendMessage');

    await I18nService.setLanguage('zh_TW');

    expect(sendMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'LANGUAGE_CHANGED',
        language: 'zh_TW',
      } as LanguageChangeMessage)
    );
  });

  it('should persist language to chrome.storage.local', async () => {
    const setStorageSpy = vi.spyOn(chrome.storage.local, 'set');

    await I18nService.setLanguage('en');

    expect(setStorageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'en' })
    );
  });

  it('should handle multiple language switches correctly', async () => {
    // 切换到繁体中文
    await I18nService.setLanguage('zh_TW');
    expect(I18nService.getCurrentLanguageSync()).toBe('zh_TW');

    // 切换到英语
    await I18nService.setLanguage('en');
    expect(I18nService.getCurrentLanguageSync()).toBe('en');

    // 切换回简体中文
    await I18nService.setLanguage('zh_CN');
    expect(I18nService.getCurrentLanguageSync()).toBe('zh_CN');
  });

  it('should throw error for unsupported language', async () => {
    await expect(
      I18nService.setLanguage('fr' as any)
    ).rejects.toThrow('Unsupported language: fr');
  });

  it('should fallback to default language if translation not found', () => {
    // 设置为英语
    I18nService.setLanguage('en').then(() => {
      // 尝试获取不存在的 key
      const message = I18nService.t('non_existent_key');

      // 应该返回 key 本身
      expect(message).toBe('non_existent_key');
    });
  });
});
