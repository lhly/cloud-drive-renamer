/**
 * 重命名规则类型
 */
export type RuleType = 'replace' | 'prefix' | 'suffix' | 'numbering' | 'sanitize';

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
