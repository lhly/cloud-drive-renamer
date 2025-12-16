import { RuleExecutor, SanitizeRuleParams } from '../types/rule';
import { parseFileName, validateFileName } from '../utils/helpers';

/**
 * 清理规则
 * 移除文件名中的非法字符或指定字符
 */
export class SanitizeRule implements RuleExecutor {
  private config: Required<SanitizeRuleParams>;

  constructor(params: SanitizeRuleParams = {}) {
    this.config = {
      removeChars: params.removeChars ?? '',
      removeIllegal: params.removeIllegal ?? true,
    };
  }

  /**
   * 执行文件名清理
   * @param fileName 原文件名
   * @param _index 文件索引（未使用）
   * @param _total 文件总数（未使用）
   * @returns 清理后的文件名
   */
  execute(fileName: string, _index: number, _total: number): string {
    const { name, ext } = parseFileName(fileName);
    let cleanedName = name;

    // 移除非法字符
    if (this.config.removeIllegal) {
      const validation = validateFileName(name);
      if (!validation.valid && validation.sanitized) {
        cleanedName = validation.sanitized;
      }
    }

    // 移除指定的字符
    if (this.config.removeChars) {
      // 转义特殊正则字符
      const escapedChars = this.config.removeChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`[${escapedChars}]`, 'g');
      cleanedName = cleanedName.replace(pattern, '');
    }

    // 移除多余的空白字符并trim
    cleanedName = cleanedName.replace(/\s+/g, ' ').trim();

    // 如果清理后的名称为空，返回默认名称
    if (!cleanedName) {
      cleanedName = 'renamed_file';
    }

    return `${cleanedName}${ext}`;
  }

  /**
   * 验证配置
   * @param config 配置对象
   * @returns 是否有效
   */
  validate(config: any): boolean {
    if (typeof config !== 'object' || config === null) {
      return true; // 空配置也是有效的，使用默认值
    }

    // 如果提供了 removeChars，必须是字符串
    if ('removeChars' in config && typeof config.removeChars !== 'string') {
      return false;
    }

    // 如果提供了 removeIllegal，必须是布尔值
    if ('removeIllegal' in config && typeof config.removeIllegal !== 'boolean') {
      return false;
    }

    return true;
  }
}
