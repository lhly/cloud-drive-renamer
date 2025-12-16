import { RuleExecutor, SuffixRuleParams } from '../types/rule';
import { parseFileName } from '../utils/helpers';

/**
 * 后缀规则
 * 在文件名后（扩展名前）添加指定的后缀
 */
export class SuffixRule implements RuleExecutor {
  private config: Required<SuffixRuleParams>;

  constructor(params: SuffixRuleParams) {
    this.config = {
      suffix: params.suffix,
      separator: params.separator ?? '',
    };
  }

  /**
   * 执行后缀添加
   * @param fileName 原文件名
   * @param _index 文件索引（未使用）
   * @param _total 文件总数（未使用）
   * @returns 添加后缀后的文件名
   */
  execute(fileName: string, _index: number, _total: number): string {
    const { name, ext } = parseFileName(fileName);
    const { suffix, separator } = this.config;

    return `${name}${separator}${suffix}${ext}`;
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
      typeof config.suffix === 'string' &&
      config.suffix.length > 0
    );
  }
}
