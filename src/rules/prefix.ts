import { RuleExecutor, PrefixRuleParams } from '../types/rule';
import { parseFileName } from '../utils/helpers';

/**
 * 前缀规则
 * 在文件名前添加指定的前缀
 */
export class PrefixRule implements RuleExecutor {
  private config: Required<PrefixRuleParams>;

  constructor(params: PrefixRuleParams) {
    this.config = {
      prefix: params.prefix,
      separator: params.separator ?? '',
    };
  }

  /**
   * 执行前缀添加
   * @param fileName 原文件名
   * @param _index 文件索引（未使用）
   * @param _total 文件总数（未使用）
   * @returns 添加前缀后的文件名
   */
  execute(fileName: string, _index: number, _total: number): string {
    const { name, ext } = parseFileName(fileName);
    const { prefix, separator } = this.config;

    return `${prefix}${separator}${name}${ext}`;
  }

  /**
   * 验证配置
   * @param config 配置对象
   * @returns 是否有效
   */
  validate(config: any): boolean {
    return (
      typeof config === 'object' &&
      config !== null &&
      typeof config.prefix === 'string' &&
      config.prefix.length > 0
    );
  }
}
