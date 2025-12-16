import { BaseRule } from './base-rule';
import { NumberingRuleParams } from '../types/rule';

/**
 * 自动编号规则
 */
export class NumberingRule extends BaseRule {
  protected config!: NumberingRuleParams;

  execute(fileName: string, index: number): string {
    const { name, ext } = this.parseFileName(fileName);
    const { startNumber, digits, position, format, separator } = this.config;

    const number = (startNumber + index).toString().padStart(digits, '0');
    const formatted = format.replace('{num}', number);

    if (position === 'prefix') {
      return `${formatted}${separator}${name}${ext}`;
    } else {
      return `${name}${separator}${formatted}${ext}`;
    }
  }

  validate(config: any): boolean {
    return (
      typeof config === 'object' &&
      typeof config.startNumber === 'number' &&
      typeof config.digits === 'number' &&
      config.digits > 0 &&
      ['prefix', 'suffix'].includes(config.position) &&
      typeof config.format === 'string' &&
      typeof config.separator === 'string'
    );
  }
}
