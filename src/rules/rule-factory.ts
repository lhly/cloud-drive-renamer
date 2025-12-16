import { RuleConfig, RuleExecutor } from '../types/rule';
import { ReplaceRule } from './replace';
import { NumberingRule } from './numbering';
import { PrefixRule } from './prefix';
import { SuffixRule } from './suffix';
import { SanitizeRule } from './sanitize';

/**
 * 规则工厂
 * 根据配置创建对应的规则实例
 */
export class RuleFactory {
  /**
   * 创建规则实例
   * @param config 规则配置
   * @returns 规则执行器
   */
  static create(config: RuleConfig): RuleExecutor {
    switch (config.type) {
      case 'replace':
        return new ReplaceRule(config.params as any);

      case 'prefix':
        return new PrefixRule(config.params as any);

      case 'suffix':
        return new SuffixRule(config.params as any);

      case 'numbering':
        return new NumberingRule(config.params as any);

      case 'sanitize':
        return new SanitizeRule(config.params as any);

      default:
        throw new Error(`Unknown rule type: ${config.type}`);
    }
  }

  /**
   * 验证规则配置
   * @param config 规则配置
   * @returns 是否有效
   */
  static validate(config: RuleConfig): boolean {
    try {
      const rule = this.create(config);
      return rule !== null;
    } catch {
      return false;
    }
  }
}
