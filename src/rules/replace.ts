import { BaseRule } from './base-rule';
import { ReplaceRuleParams } from '../types/rule';

/**
 * 字符串替换规则
 */
export class ReplaceRule extends BaseRule {
  protected config!: ReplaceRuleParams;

  execute(fileName: string): string {
    const { name, ext } = this.parseFileName(fileName);
    const { search, replace, caseSensitive = false, global = false } = this.config;

    const flags = (global ? 'g' : '') + (caseSensitive ? '' : 'i');
    const pattern = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);

    const newName = name.replace(pattern, replace);
    return newName + ext;
  }

  validate(config: any): boolean {
    return (
      typeof config === 'object' &&
      typeof config.search === 'string' &&
      config.search.length > 0 &&
      typeof config.replace === 'string'
    );
  }
}
