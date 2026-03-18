/**
 * 重命名规则类型
 */
export type RuleType =
  | 'replace'
  | 'regex'
  | 'prefix'
  | 'suffix'
  | 'numbering'
  | 'sanitize'
  | 'episodeExtract';

/**
 * 规则配置接口
 */
export interface RuleConfig {
  /** 规则类型 */
  type: RuleType;
  /** 规则参数 */
  params: Record<string, any>;
}

/**
 * 替换规则参数
 */
export interface ReplaceRuleParams {
  /** 搜索文本 */
  search: string;
  /** 替换文本 */
  replace: string;
  /** 是否大小写敏感 */
  caseSensitive?: boolean;
  /** 是否全局替换 */
  global?: boolean;
}

/**
 * 正则替换规则参数
 */
export interface RegexRuleParams {
  /** 正则表达式（不包含前后 /） */
  pattern: string;
  /** 替换表达式 */
  replace: string;
  /** 是否大小写敏感 */
  caseSensitive?: boolean;
  /** 是否全局替换 */
  global?: boolean;
  /**
   * 自定义 flags（高级，可选）
   * - `g/i` 由 `global/caseSensitive` 控制，建议这里输入其它 flags（如 `m/s/u`）
   */
  flags?: string;
  /**
   * 是否在匹配时包含扩展名（允许修改后缀）
   * - false（默认）：只对文件名主体（不含扩展名）做替换
   * - true：对完整文件名（含扩展名）做替换
   */
  includeExtension?: boolean;
}

/**
 * 前缀规则参数
 */
export interface PrefixRuleParams {
  /** 前缀文本 */
  prefix: string;
  /** 分隔符 */
  separator?: string;
}

/**
 * 后缀规则参数
 */
export interface SuffixRuleParams {
  /** 后缀文本 */
  suffix: string;
  /** 分隔符 */
  separator?: string;
}

/**
 * 编号规则参数
 */
export interface NumberingRuleParams {
  /** 起始编号 */
  startNumber: number;
  /** 位数 */
  digits: number;
  /** 位置 */
  position: 'prefix' | 'suffix';
  /** 格式化模板 */
  format: string;
  /** 分隔符 */
  separator: string;
}

/**
 * 清理规则参数
 */
export interface SanitizeRuleParams {
  /** 要移除的字符集 */
  removeChars?: string;
  /** 是否移除非法字符 */
  removeIllegal?: boolean;
}

/**
 * 剧集提取规则参数
 */
export interface EpisodeExtractRuleParams {
  /** 输出模板，支持变量：{prefix} {season} {episode} {ext} */
  template: string;
  /** 剧名/前缀 */
  prefix: string;
  /** 季号（默认 1） */
  season?: number | string;
  /** 集数偏移（默认 0） */
  offset?: number | string;
  /** 集数前导零位数（默认 3，范围 1~10） */
  leadingZeroCount?: number;
  /** 集数前锚点（可选） */
  helperPre?: string;
  /** 集数后锚点（可选） */
  helperPost?: string;
}

/**
 * 规则执行器接口
 */
export interface RuleExecutor {
  /**
   * 执行规则
   * @param fileName 原文件名
   * @param index 文件索引
   * @param total 文件总数
   * @returns 新文件名
   */
  execute(fileName: string, index: number, total: number): string;

  /**
   * 验证配置
   * @param config 配置对象
   * @returns 是否有效
   */
  validate(config: any): boolean;
}
