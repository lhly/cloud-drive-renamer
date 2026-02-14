import { BaseRule } from './base-rule';
import { RegexRuleParams } from '../types/rule';

/**
 * 正则替换规则
 * 支持使用正则表达式对“文件名（不含扩展名）”进行替换。
 *
 * 注意：为了避免误伤扩展名，这里默认不处理扩展名部分。
 */
export class RegexRule extends BaseRule {
  protected config!: RegexRuleParams;

  private getFlags(): string {
    const { caseSensitive = false, global = false, flags = '' } = this.config;

    const base = (global ? 'g' : '') + (caseSensitive ? '' : 'i');

    // Keep only letters, lower-cased; `g/i` are controlled by toggles.
    const cleaned = String(flags).replace(/[^a-z]/gi, '').toLowerCase();
    const extraSet = new Set<string>();
    for (const ch of cleaned) {
      if (ch === 'g' || ch === 'i') continue;
      extraSet.add(ch);
    }

    // Stable ordering for common flags to reduce user confusion.
    const preferredOrder = ['m', 's', 'u', 'y', 'd', 'v'];
    const extras: string[] = [];
    for (const ch of preferredOrder) {
      if (extraSet.has(ch)) {
        extras.push(ch);
        extraSet.delete(ch);
      }
    }
    // Append any remaining flags in first-seen order.
    for (const ch of extraSet) {
      extras.push(ch);
    }

    return base + extras.join('');
  }

  execute(fileName: string): string {
    const { name, ext } = this.parseFileName(fileName);
    const { pattern, replace, includeExtension = false } = this.config;

    const re = new RegExp(pattern, this.getFlags());

    if (includeExtension) {
      return fileName.replace(re, replace);
    }

    const newName = name.replace(re, replace);
    return newName + ext;
  }

  validate(config: any): boolean {
    if (typeof config !== 'object' || config === null) {
      return false;
    }

    if (typeof config.pattern !== 'string' || config.pattern.length === 0) {
      return false;
    }

    if (typeof config.replace !== 'string') {
      return false;
    }

    if ('flags' in config && typeof config.flags !== 'string') {
      return false;
    }

    if ('includeExtension' in config && typeof config.includeExtension !== 'boolean') {
      return false;
    }

    const base = (config.global ? 'g' : '') + (config.caseSensitive ? '' : 'i');
    const cleaned = String(config.flags ?? '').replace(/[^a-z]/gi, '').toLowerCase();
    const extras = Array.from(new Set(cleaned.split(''))).filter((ch) => ch !== 'g' && ch !== 'i');
    const flags = base + extras.join('');

    try {
      // Ensure pattern/flags are valid.
      // eslint-disable-next-line no-new
      new RegExp(config.pattern, flags);
    } catch {
      return false;
    }

    return true;
  }
}
