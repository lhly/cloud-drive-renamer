import { RuleExecutor } from '../types/rule';
import { parseFileName } from '../utils/helpers';

/**
 * 规则基类
 * 提供通用的规则执行逻辑
 */
export abstract class BaseRule implements RuleExecutor {
  protected config: any;

  constructor(config: any) {
    if (!this.validate(config)) {
      throw new Error('Invalid rule configuration');
    }
    this.config = config;
  }

  /**
   * 执行规则
   * 子类必须实现
   */
  abstract execute(fileName: string, index: number, total: number): string;

  /**
   * 验证配置
   * 子类必须实现
   */
  abstract validate(config: any): boolean;

  /**
   * 应用规则到文件名(不含扩展名)
   * @param name 文件名(不含扩展名)
   * @param ext 扩展名
   * @param index 索引
   * @param total 总数
   * @returns 新文件名(含扩展名)
   */
  protected applyToName(
    name: string,
    ext: string,
    _index: number,
    _total: number
  ): string {
    return name + ext;
  }

  /**
   * 解析文件名
   */
  protected parseFileName(fileName: string): { name: string; ext: string } {
    return parseFileName(fileName);
  }
}
