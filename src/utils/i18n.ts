/**
 * 自定义国际化服务
 * 实现真正的运行时动态语言切换
 *
 * 🔄 变更说明：
 * - 不再依赖 chrome.i18n.getMessage()（该API不支持运行时切换）
 * - 直接加载和管理JSON翻译文件
 * - 支持真正的运行时语言切换，无需重启扩展
 */

import {
  SupportedLanguage,
  MessageSubstitution,
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  LanguageChangeMessage,
} from '../types/i18n';

// 导入翻译文件
import zhCNTranslations from '../locales/zh_CN.json';
import zhTWTranslations from '../locales/zh_TW.json';
import enTranslations from '../locales/en.json';

/**
 * 翻译字典类型
 */
type TranslationDictionary = Record<string, string>;

/**
 * 所有语言的翻译集合
 */
type TranslationsCollection = Record<SupportedLanguage, TranslationDictionary>;

/**
 * 自定义国际化服务类
 * 提供完整的动态翻译功能
 */
export class I18nService {
  /**
   * 所有语言的翻译数据（预加载到内存）
   */
  private static translations: TranslationsCollection = {
    zh_CN: zhCNTranslations as TranslationDictionary,
    zh_TW: zhTWTranslations as TranslationDictionary,
    en: enTranslations as TranslationDictionary,
  };

  /**
   * 当前语言
   */
  private static currentLanguage: SupportedLanguage = DEFAULT_LANGUAGE;

  /**
   * 获取翻译文本
   * @param key 翻译键名
   * @param substitutions 可选的占位符替换值（支持 $1, $2, ... 或数组）
   * @returns 翻译后的文本，如果找不到则返回key本身
   */
  static t(key: string, substitutions?: MessageSubstitution): string {
    try {
      // 获取当前语言的翻译字典
      const dict = this.translations[this.currentLanguage];
      let message = dict[key];

      // 如果当前语言没有翻译，尝试回退到默认语言
      if (!message && this.currentLanguage !== DEFAULT_LANGUAGE) {
        message = this.translations[DEFAULT_LANGUAGE][key];
      }

      // 如果仍然没有找到，返回key本身
      if (!message) {
        console.warn(`[I18n] Translation missing for key: ${key}`);
        return key;
      }

      // 处理占位符替换
      if (substitutions) {
        message = this.replaceSubstitutions(message, substitutions);
      }

      return message;
    } catch (error) {
      console.warn(`[I18n] Failed to get message for key: ${key}`, error);
      return key;
    }
  }

  /**
   * 占位符替换
   * 支持 Chrome Extension 格式：$1, $2, $3...
   * @param message 原始消息
   * @param substitutions 替换值（字符串或字符串数组）
   * @returns 替换后的消息
   * @private
   */
  private static replaceSubstitutions(
    message: string,
    substitutions: MessageSubstitution
  ): string {
    const subs = Array.isArray(substitutions) ? substitutions : [substitutions];

    let result = message;
    subs.forEach((sub, index) => {
      // Chrome Extension 使用 $1, $2, $3... 格式
      const placeholder = `$${index + 1}`;
      result = result.replace(new RegExp(`\\${placeholder}`, 'g'), sub);
    });

    return result;
  }

  /**
   * 获取当前语言
   * 优先级: 用户设置 > 浏览器语言 > 默认(zh_CN)
   * @returns 当前语言代码
   */
  static async getCurrentLanguage(): Promise<SupportedLanguage> {
    try {
      // 1. 检查用户手动设置
      const stored = await chrome.storage.local.get(LANGUAGE_STORAGE_KEY);
      if (stored[LANGUAGE_STORAGE_KEY]) {
        const storedLang = stored[LANGUAGE_STORAGE_KEY] as string;
        if (this.isSupportedLanguage(storedLang)) {
          this.currentLanguage = storedLang;
          return storedLang;
        }
      }

      // 2. 检测浏览器语言
      const browserLang = this.detectBrowserLanguage();
      this.currentLanguage = browserLang;
      return browserLang;
    } catch (error) {
      console.warn('[I18n] Failed to get current language', error);
      this.currentLanguage = DEFAULT_LANGUAGE;
      return DEFAULT_LANGUAGE;
    }
  }

  /**
   * 设置语言（支持运行时动态切换）
   * @param lang 要设置的语言
   */
  static async setLanguage(lang: SupportedLanguage): Promise<void> {
    try {
      if (!this.isSupportedLanguage(lang)) {
        throw new Error(`Unsupported language: ${lang}`);
      }

      // Early return: 如果语言已经是当前语言，跳过重复设置
      if (this.currentLanguage === lang) {
        return;
      }

      // 保存到storage
      await chrome.storage.local.set({ [LANGUAGE_STORAGE_KEY]: lang });

      // 🔑 关键：立即更新当前语言（真正的动态切换）
      this.currentLanguage = lang;

      // 通知所有组件语言变更
      this.notifyLanguageChange(lang);
    } catch (error) {
      console.error('[I18n] Failed to set language', error);
      throw error;
    }
  }

  /**
   * 检测浏览器语言
   * 将浏览器语言代码规范化为支持的语言
   * @returns 规范化后的语言代码
   * @private
   */
  private static detectBrowserLanguage(): SupportedLanguage {
    try {
      const browserLang = chrome.i18n.getUILanguage();
      return this.normalizeBrowserLanguage(browserLang);
    } catch (error) {
      console.warn('[I18n] Failed to detect browser language', error);
      return DEFAULT_LANGUAGE;
    }
  }

  /**
   * 规范化浏览器语言代码
   * @param browserLang 浏览器返回的语言代码(如: zh-CN, zh-TW, en-US)
   * @returns 规范化后的语言代码
   * @private
   */
  private static normalizeBrowserLanguage(browserLang: string): SupportedLanguage {
    // 转换为小写并处理常见格式
    const normalized = browserLang.toLowerCase().replace('-', '_');

    // 精确匹配
    if (normalized === 'zh_cn') return 'zh_CN';
    if (normalized === 'zh_tw' || normalized === 'zh_hk') return 'zh_TW';

    // 前缀匹配
    if (normalized.startsWith('zh')) {
      // 默认简体中文
      return 'zh_CN';
    }

    if (normalized.startsWith('en')) {
      return 'en';
    }

    // 回退到默认语言
    return DEFAULT_LANGUAGE;
  }

  /**
   * 通知所有组件语言变更
   * @param lang 新的语言
   * @private
   */
  private static notifyLanguageChange(lang: SupportedLanguage): void {
    try {
      const message: LanguageChangeMessage = {
        type: 'LANGUAGE_CHANGED',
        language: lang,
      };

      // 发送消息到所有content scripts和其他扩展页面
      chrome.runtime.sendMessage(message).catch((error: Error) => {
        // 忽略"Could not establish connection"错误(没有接收者时的正常情况)
        if (!error.message?.includes('Could not establish connection')) {
          console.warn('[I18n] Failed to send language change message', error);
        }
      });

      // 只在有 chrome.tabs 权限的上下文中发送消息到标签页
      // Content script 和 Dialog iframe 没有 chrome.tabs 权限
      if (typeof chrome.tabs !== 'undefined') {
        chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, message).catch((error: Error) => {
              // 忽略连接错误
              if (!error.message?.includes('Could not establish connection')) {
                console.warn('[I18n] Failed to send message to tab', error);
              }
            });
          }
        });
      }
    } catch (error) {
      console.warn('[I18n] Failed to notify language change', error);
    }
  }

  /**
   * 检查是否为支持的语言
   * @param lang 要检查的语言代码
   * @returns 是否支持
   * @private
   */
  private static isSupportedLanguage(lang: string): lang is SupportedLanguage {
    return SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage);
  }

  /**
   * 同步获取当前语言(从缓存)
   * @returns 当前语言
   */
  static getCurrentLanguageSync(): SupportedLanguage {
    return this.currentLanguage;
  }

  /**
   * 格式化带占位符的消息
   * 支持多个占位符替换
   * @param key 翻译键名
   * @param args 占位符参数
   * @returns 格式化后的文本
   */
  static formatMessage(key: string, ...args: string[]): string {
    return this.t(key, args);
  }

  /**
   * 获取所有可用的翻译键
   * @returns 翻译键列表
   */
  static getAvailableKeys(): string[] {
    return Object.keys(this.translations[this.currentLanguage]);
  }

  /**
   * 检查翻译键是否存在
   * @param key 翻译键名
   * @returns 是否存在
   */
  static hasKey(key: string): boolean {
    return key in this.translations[this.currentLanguage];
  }
}

/**
 * 简化的翻译函数别名
 * @param key 翻译键名
 * @param substitutions 可选的占位符替换值
 * @returns 翻译后的文本
 */
export const t = (key: string, substitutions?: MessageSubstitution): string => {
  return I18nService.t(key, substitutions);
};

/**
 * 初始化i18n服务
 * 应在应用启动时调用
 */
export async function initI18n(): Promise<SupportedLanguage> {
  const lang = await I18nService.getCurrentLanguage();
  return lang;
}
