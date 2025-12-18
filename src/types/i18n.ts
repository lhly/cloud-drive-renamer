/**
 * 国际化类型定义
 */

/**
 * 支持的语言列表
 */
export type SupportedLanguage = 'zh_CN' | 'zh_TW' | 'en';

/**
 * 语言变更消息
 */
export interface LanguageChangeMessage {
  type: 'LANGUAGE_CHANGED';
  language: SupportedLanguage;
}

/**
 * 翻译消息占位符类型
 */
export type MessageSubstitution = string | string[];

/**
 * 语言配置存储键
 */
export const LANGUAGE_STORAGE_KEY = 'language';

/**
 * 支持的语言列表常量
 */
export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = [
  'zh_CN',
  'zh_TW',
  'en',
] as const;

/**
 * 默认语言
 */
export const DEFAULT_LANGUAGE: SupportedLanguage = 'zh_CN';

/**
 * 语言显示名称映射
 */
export const LANGUAGE_DISPLAY_NAMES: Record<SupportedLanguage, string> = {
  zh_CN: '简体中文',
  zh_TW: '繁體中文',
  en: 'English',
};
