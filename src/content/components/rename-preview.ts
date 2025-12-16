import { LitElement, html, css } from 'lit';
import { property, state } from 'lit/decorators.js';
import { virtualize } from '@lit-labs/virtualizer/virtualize.js';
import { RuleConfig } from '../../types/rule';
import { FileItem } from '../../types/platform';
import { RuleFactory } from '../../rules/rule-factory';
import { logger } from '../../utils/logger';

/**
 * 预览项接口
 */
interface PreviewItem {
  original: string;
  renamed: string;
  hasConflict: boolean;
  hasChange: boolean;
}

/**
 * 重命名预览组件
 * 支持虚拟滚动，显示文件重命名前后的对比
 *
 * 使用方式:
 * <rename-preview
 *   .files=${files}
 *   .rule=${ruleConfig}>
 * </rename-preview>
 *
 * 注意：组件需要通过 customElements.define() 手动注册
 */
export class RenamePreview extends LitElement {
  /**
   * 文件列表
   */
  @property({ type: Array })
  files: FileItem[] = [];

  /**
   * 重命名规则配置
   */
  @property({ type: Object })
  rule!: RuleConfig;

  /**
   * 预览数据
   */
  @state()
  private previewData: PreviewItem[] = [];

  /**
   * 是否使用虚拟滚动
   */
  @state()
  private useVirtualScroll = false;

  /**
   * 虚拟滚动阈值
   */
  private readonly VIRTUAL_SCROLL_THRESHOLD = 100;

  static styles = css`
    :host {
      display: block;
    }

    .preview-container {
      max-height: 400px;
      overflow-y: auto;
      border: 1px solid #e8e8e8;
      border-radius: 4px;
      background-color: #fafafa;
    }

    .preview-list {
      padding: 8px;
    }

    .preview-item {
      display: flex;
      align-items: center;
      padding: 12px;
      margin-bottom: 8px;
      background-color: #ffffff;
      border: 1px solid #e8e8e8;
      border-radius: 4px;
      font-size: 13px;
      transition: all 0.2s;
    }

    .preview-item:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }

    .preview-item.conflict {
      background-color: #fff2e8;
      border-color: #ffbb96;
    }

    .preview-item.no-change {
      opacity: 0.6;
    }

    .original {
      flex: 1;
      color: #666;
      word-break: break-all;
      padding-right: 12px;
    }

    .arrow {
      flex-shrink: 0;
      padding: 0 12px;
      color: #1890ff;
      font-weight: bold;
    }

    .renamed {
      flex: 1;
      color: #333;
      font-weight: 500;
      word-break: break-all;
      padding-left: 12px;
    }

    .renamed .highlight {
      background-color: #fff3bf;
      padding: 2px 4px;
      border-radius: 2px;
    }

    .conflict-badge {
      flex-shrink: 0;
      padding: 4px 8px;
      background-color: #ff4d4f;
      color: white;
      border-radius: 4px;
      font-size: 12px;
      margin-left: 12px;
    }

    .no-change-badge {
      flex-shrink: 0;
      padding: 4px 8px;
      background-color: #d9d9d9;
      color: #666;
      border-radius: 4px;
      font-size: 12px;
      margin-left: 12px;
    }

    .empty-state {
      padding: 40px 20px;
      text-align: center;
      color: #999;
    }

    .summary {
      padding: 12px;
      background-color: #f0f0f0;
      border-radius: 4px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      font-size: 13px;
    }

    .summary-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .summary-label {
      color: #666;
    }

    .summary-value {
      font-weight: 600;
      color: #333;
    }

    .summary-value.success {
      color: #52c41a;
    }

    .summary-value.warning {
      color: #faad14;
    }

    .summary-value.error {
      color: #ff4d4f;
    }

    .loading {
      padding: 20px;
      text-align: center;
      color: #999;
    }
  `;

  updated(changedProperties: Map<string | number | symbol, unknown>) {
    if (changedProperties.has('files') || changedProperties.has('rule')) {
      this.generatePreview();
    }
  }

  render() {
    if (this.files.length === 0) {
      return html`
        <div class="preview-container">
          <div class="empty-state">暂无文件可预览</div>
        </div>
      `;
    }

    if (this.previewData.length === 0) {
      return html`
        <div class="preview-container">
          <div class="loading">生成预览中...</div>
        </div>
      `;
    }

    return html`
      <div class="preview-container">
        ${this.renderSummary()}
        <div class="preview-list">
          ${this.useVirtualScroll ? this.renderVirtualList() : this.renderNormalList()}
        </div>
      </div>
    `;
  }

  private renderSummary() {
    const totalFiles = this.previewData.length;
    const changedFiles = this.previewData.filter(item => item.hasChange).length;
    const unchangedFiles = totalFiles - changedFiles;
    const conflictFiles = this.previewData.filter(item => item.hasConflict).length;

    return html`
      <div class="summary">
        <div class="summary-item">
          <span class="summary-label">总计:</span>
          <span class="summary-value">${totalFiles}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">将改变:</span>
          <span class="summary-value success">${changedFiles}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">无变化:</span>
          <span class="summary-value warning">${unchangedFiles}</span>
        </div>
        ${conflictFiles > 0
          ? html`
              <div class="summary-item">
                <span class="summary-label">冲突:</span>
                <span class="summary-value error">${conflictFiles}</span>
              </div>
            `
          : ''}
      </div>
    `;
  }

  private renderVirtualList() {
    return html`
      ${virtualize({
        items: this.previewData,
        renderItem: (item: PreviewItem) => this.renderPreviewItem(item),
      })}
    `;
  }

  private renderNormalList() {
    return html`
      ${this.previewData.map(item => this.renderPreviewItem(item))}
    `;
  }

  private renderPreviewItem(item: PreviewItem) {
    const classes = [
      'preview-item',
      item.hasConflict ? 'conflict' : '',
      !item.hasChange ? 'no-change' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return html`
      <div class=${classes}>
        <span class="original">${item.original}</span>
        <span class="arrow">→</span>
        <span class="renamed">${this.highlightChanges(item.original, item.renamed)}</span>
        ${item.hasConflict
          ? html`<span class="conflict-badge">冲突</span>`
          : !item.hasChange
          ? html`<span class="no-change-badge">无变化</span>`
          : ''}
      </div>
    `;
  }

  /**
   * 生成预览数据
   */
  private generatePreview() {
    if (!this.rule || this.files.length === 0) {
      this.previewData = [];
      return;
    }

    // 验证规则配置的基本有效性
    if (!this.isValidRuleConfig(this.rule)) {
      this.previewData = [];
      return;
    }

    try {
      const ruleExecutor = RuleFactory.create(this.rule);
      const startTime = performance.now();

      this.previewData = this.files.map((file, index) => {
        const original = file.name;
        const renamed = ruleExecutor.execute(file.name, index, this.files.length);

        return {
          original,
          renamed,
          hasConflict: false, // 冲突检查在实际重命名时进行
          hasChange: original !== renamed,
        };
      });

      // 确定是否使用虚拟滚动
      this.useVirtualScroll = this.files.length > this.VIRTUAL_SCROLL_THRESHOLD;

      const endTime = performance.now();
      const duration = endTime - startTime;

      logger.info(
        `Generated preview for ${this.files.length} files in ${duration.toFixed(2)}ms`
      );

      // 性能警告
      if (duration > 200) {
        logger.warn(
          `Preview generation took longer than 200ms (${duration.toFixed(2)}ms)`
        );
      }
    } catch (error) {
      logger.error('Failed to generate preview:', error instanceof Error ? error : new Error(String(error)));
      this.previewData = [];
    }
  }

  /**
   * 验证规则配置是否有效
   */
  private isValidRuleConfig(rule: RuleConfig): boolean {
    if (!rule || !rule.type) {
      return false;
    }

    const params = rule.params || {};

    // 根据规则类型验证参数
    switch (rule.type) {
      case 'replace':
        // Replace 规则要求 search 非空
        return typeof params.search === 'string' && params.search.length > 0;

      case 'prefix':
        // Prefix 规则要求 prefix 非空
        return typeof params.prefix === 'string' && params.prefix.length > 0;

      case 'suffix':
        // Suffix 规则要求 suffix 非空
        return typeof params.suffix === 'string' && params.suffix.length > 0;

      case 'numbering':
        // Numbering 规则参数可选，默认有效
        return true;

      case 'sanitize':
        // Sanitize 规则参数可选，默认有效
        return true;

      default:
        return false;
    }
  }

  /**
   * 高亮文件名变化部分
   * 简化版实现：如果文件名改变，高亮整个新文件名
   */
  private highlightChanges(original: string, renamed: string): any {
    if (original === renamed) {
      return html`${renamed}`;
    }

    // 简单实现：高亮整个重命名后的文件名
    // 更复杂的实现可以使用字符串diff算法来精确高亮变化部分
    return html`<span class="highlight">${renamed}</span>`;
  }
}

// 声明模块以支持 TypeScript
declare global {
  interface HTMLElementTagNameMap {
    'rename-preview': RenamePreview;
  }
}
