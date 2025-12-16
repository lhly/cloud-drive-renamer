import { LitElement, html, css } from 'lit';
import { property, state } from 'lit/decorators.js';
import { RuleType, RuleConfig } from '../../types/rule';
import { FileItem } from '../../types/platform';

/**
 * 重命名对话框组件
 * 提供规则选择和配置界面
 *
 * 使用方式:
 * <rename-dialog
 *   .open=${true}
 *   .files=${files}
 *   @dialog-close=${handler}
 *   @dialog-confirm=${handler}>
 * </rename-dialog>
 *
 * 注意：组件需要通过 customElements.define() 手动注册
 */
export class RenameDialog extends LitElement {
  /**
   * 对话框是否打开
   */
  @property({ type: Boolean })
  open = false;

  /**
   * 选中的文件列表
   */
  @property({ type: Array })
  files: FileItem[] = [];

  /**
   * 当前选中的规则类型
   */
  @state()
  private selectedRuleType: RuleType = 'replace';

  /**
   * 规则参数配置
   */
  @state()
  private ruleParams: Record<string, any> = {
    // Replace 规则默认参数
    search: '',
    replace: '',
    caseSensitive: false,
    global: true,
  };

  static styles = css`
    :host {
      display: block;
    }

    .dialog-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 9998;
      animation: fadeIn 0.3s ease;
    }

    .dialog-overlay::before {
      content: '';
      position: absolute;
      inset: 0;
      background-color: transparent;
      pointer-events: none;
      z-index: 0;
    }

    .dialog-overlay.open {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    .dialog {
      background: white;
      border-radius: 8px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      max-width: 800px;
      width: 90%;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      animation: slideUp 0.3s ease;
      position: relative;
      z-index: 1;
    }

    @keyframes slideUp {
      from {
        transform: translateY(20px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    .dialog-header {
      padding: 20px 24px;
      border-bottom: 1px solid #f0f0f0;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .dialog-title {
      font-size: 18px;
      font-weight: 600;
      color: #333;
    }

    .close-button {
      width: 32px;
      height: 32px;
      border: none;
      background: transparent;
      color: #999;
      font-size: 20px;
      cursor: pointer;
      border-radius: 4px;
      transition: all 0.2s;
    }

    .close-button:hover {
      background: #f5f5f5;
      color: #333;
    }

    .dialog-body {
      padding: 24px;
      overflow-y: auto;
      flex: 1;
    }

    .rule-selector {
      margin-bottom: 24px;
    }

    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: #333;
      margin-bottom: 12px;
    }

    .rule-options {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px;
    }

    .rule-option {
      padding: 12px 16px;
      border: 2px solid #d9d9d9;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
      text-align: center;
    }

    .rule-option:hover {
      border-color: #1890ff;
    }

    .rule-option.selected {
      border-color: #1890ff;
      background-color: #e6f7ff;
      color: #1890ff;
    }

    .rule-option input[type='radio'] {
      display: none;
    }

    .rule-config {
      margin-bottom: 24px;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-label {
      display: block;
      font-size: 14px;
      color: #666;
      margin-bottom: 8px;
    }

    .form-input,
    .form-select {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #d9d9d9;
      border-radius: 4px;
      font-size: 14px;
      transition: border-color 0.2s;
      box-sizing: border-box;
    }

    .form-input:focus,
    .form-select:focus {
      outline: none;
      border-color: #1890ff;
    }

    .form-checkbox {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .form-checkbox input {
      width: 16px;
      height: 16px;
      cursor: pointer;
    }

    .preview-section {
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid #f0f0f0;
    }

    .dialog-footer {
      padding: 16px 24px;
      border-top: 1px solid #f0f0f0;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }

    .button {
      padding: 8px 20px;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .button-default {
      background-color: #fff;
      color: #333;
      border: 1px solid #d9d9d9;
    }

    .button-default:hover {
      border-color: #1890ff;
      color: #1890ff;
    }

    .button-primary {
      background-color: #1890ff;
      color: #fff;
    }

    .button-primary:hover {
      background-color: #40a9ff;
    }

    .button-primary:active {
      background-color: #096dd9;
    }

    .hint-text {
      font-size: 12px;
      color: #999;
      margin-top: 4px;
    }
  `;

  render() {
    return html`
      <div class="dialog-overlay ${this.open ? 'open' : ''}" @click=${this.handleOverlayClick}>
        <div class="dialog" @click=${this.stopPropagation}>
          ${this.renderHeader()} ${this.renderBody()} ${this.renderFooter()}
        </div>
      </div>
    `;
  }

  private renderHeader() {
    return html`
      <div class="dialog-header">
        <div class="dialog-title">
          批量重命名 (${this.files.length} 个文件)
        </div>
        <button class="close-button" @click=${this.handleClose}>×</button>
      </div>
    `;
  }

  private renderBody() {
    return html`
      <div class="dialog-body">
        ${this.renderRuleSelector()} ${this.renderRuleConfig()} ${this.renderPreview()}
      </div>
    `;
  }

  private renderRuleSelector() {
    const rules: { type: RuleType; label: string; description: string }[] = [
      { type: 'replace', label: '字符串替换', description: '替换文件名中的字符' },
      { type: 'prefix', label: '添加前缀', description: '在文件名前添加文本' },
      { type: 'suffix', label: '添加后缀', description: '在扩展名前添加文本' },
      { type: 'numbering', label: '添加编号', description: '添加顺序编号' },
      { type: 'sanitize', label: '清理文件名', description: '移除非法字符' },
    ];

    return html`
      <div class="rule-selector">
        <div class="section-title">选择重命名规则</div>
        <div class="rule-options">
          ${rules.map(
            rule => html`
              <label
                class="rule-option ${this.selectedRuleType === rule.type ? 'selected' : ''}"
                title=${rule.description}
              >
                <input
                  type="radio"
                  name="rule"
                  value=${rule.type}
                  ?checked=${this.selectedRuleType === rule.type}
                  @change=${() => this.handleRuleChange(rule.type)}
                />
                <div>${rule.label}</div>
              </label>
            `
          )}
        </div>
      </div>
    `;
  }

  private renderRuleConfig() {
    return html`
      <div class="rule-config">
        <div class="section-title">配置参数</div>
        ${this.renderRuleParams()}
      </div>
    `;
  }

  private renderRuleParams() {
    switch (this.selectedRuleType) {
      case 'replace':
        return this.renderReplaceParams();
      case 'prefix':
        return this.renderPrefixParams();
      case 'suffix':
        return this.renderSuffixParams();
      case 'numbering':
        return this.renderNumberingParams();
      case 'sanitize':
        return this.renderSanitizeParams();
      default:
        return html`<div>未知规则类型</div>`;
    }
  }

  private renderReplaceParams() {
    return html`
      <div class="form-group">
        <label class="form-label">搜索文本</label>
        <input
          type="text"
          class="form-input"
          .value=${this.ruleParams.search || ''}
          @input=${(e: Event) => this.updateParam('search', (e.target as HTMLInputElement).value)}
          placeholder="要替换的文本"
        />
      </div>

      <div class="form-group">
        <label class="form-label">替换为</label>
        <input
          type="text"
          class="form-input"
          .value=${this.ruleParams.replace || ''}
          @input=${(e: Event) => this.updateParam('replace', (e.target as HTMLInputElement).value)}
          placeholder="新的文本"
        />
      </div>

      <div class="form-group">
        <label class="form-checkbox">
          <input
            type="checkbox"
            ?checked=${this.ruleParams.caseSensitive || false}
            @change=${(e: Event) => this.updateParam('caseSensitive', (e.target as HTMLInputElement).checked)}
          />
          <span>大小写敏感</span>
        </label>
      </div>

      <div class="form-group">
        <label class="form-checkbox">
          <input
            type="checkbox"
            ?checked=${this.ruleParams.global ?? true}
            @change=${(e: Event) => this.updateParam('global', (e.target as HTMLInputElement).checked)}
          />
          <span>替换所有匹配项</span>
        </label>
      </div>
    `;
  }

  private renderPrefixParams() {
    return html`
      <div class="form-group">
        <label class="form-label">前缀文本</label>
        <input
          type="text"
          class="form-input"
          .value=${this.ruleParams.prefix || ''}
          @input=${(e: Event) => this.updateParam('prefix', (e.target as HTMLInputElement).value)}
          placeholder="要添加的前缀"
        />
      </div>

      <div class="form-group">
        <label class="form-label">分隔符（可选）</label>
        <input
          type="text"
          class="form-input"
          .value=${this.ruleParams.separator || ''}
          @input=${(e: Event) => this.updateParam('separator', (e.target as HTMLInputElement).value)}
          placeholder="例如: - 或 _"
        />
        <div class="hint-text">在前缀和原文件名之间插入的分隔符</div>
      </div>
    `;
  }

  private renderSuffixParams() {
    return html`
      <div class="form-group">
        <label class="form-label">后缀文本</label>
        <input
          type="text"
          class="form-input"
          .value=${this.ruleParams.suffix || ''}
          @input=${(e: Event) => this.updateParam('suffix', (e.target as HTMLInputElement).value)}
          placeholder="要添加的后缀"
        />
      </div>

      <div class="form-group">
        <label class="form-label">分隔符（可选）</label>
        <input
          type="text"
          class="form-input"
          .value=${this.ruleParams.separator || ''}
          @input=${(e: Event) => this.updateParam('separator', (e.target as HTMLInputElement).value)}
          placeholder="例如: - 或 _"
        />
        <div class="hint-text">在原文件名和后缀之间插入的分隔符</div>
      </div>
    `;
  }

  private renderNumberingParams() {
    return html`
      <div class="form-group">
        <label class="form-label">起始编号</label>
        <input
          type="number"
          class="form-input"
          .value=${String(this.ruleParams.startNumber ?? 1)}
          @input=${(e: Event) => this.updateParam('startNumber', parseInt((e.target as HTMLInputElement).value, 10))}
          min="0"
        />
      </div>

      <div class="form-group">
        <label class="form-label">编号位数</label>
        <input
          type="number"
          class="form-input"
          .value=${String(this.ruleParams.digits ?? 3)}
          @input=${(e: Event) => this.updateParam('digits', parseInt((e.target as HTMLInputElement).value, 10))}
          min="1"
          max="10"
        />
        <div class="hint-text">例如: 3位数 → 001, 002, 003</div>
      </div>

      <div class="form-group">
        <label class="form-label">位置</label>
        <select
          class="form-select"
          .value=${this.ruleParams.position || 'prefix'}
          @change=${(e: Event) => this.updateParam('position', (e.target as HTMLSelectElement).value)}
        >
          <option value="prefix">前缀（文件名前）</option>
          <option value="suffix">后缀（扩展名前）</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">格式化模板</label>
        <input
          type="text"
          class="form-input"
          .value=${this.ruleParams.format || '{num}'}
          @input=${(e: Event) => this.updateParam('format', (e.target as HTMLInputElement).value)}
          placeholder="{num}"
        />
        <div class="hint-text">使用 {num} 表示编号位置</div>
      </div>

      <div class="form-group">
        <label class="form-label">分隔符</label>
        <input
          type="text"
          class="form-input"
          .value=${this.ruleParams.separator || '-'}
          @input=${(e: Event) => this.updateParam('separator', (e.target as HTMLInputElement).value)}
          placeholder="-"
        />
      </div>
    `;
  }

  private renderSanitizeParams() {
    return html`
      <div class="form-group">
        <label class="form-checkbox">
          <input
            type="checkbox"
            ?checked=${this.ruleParams.removeIllegal ?? true}
            @change=${(e: Event) => this.updateParam('removeIllegal', (e.target as HTMLInputElement).checked)}
          />
          <span>移除非法字符</span>
        </label>
        <div class="hint-text">自动移除 / \ : * ? " < > |  等字符</div>
      </div>

      <div class="form-group">
        <label class="form-label">额外移除的字符（可选）</label>
        <input
          type="text"
          class="form-input"
          .value=${this.ruleParams.removeChars || ''}
          @input=${(e: Event) => this.updateParam('removeChars', (e.target as HTMLInputElement).value)}
          placeholder="例如: [](){}"
        />
        <div class="hint-text">输入要额外移除的字符</div>
      </div>
    `;
  }

  private renderPreview() {
    return html`
      <div class="preview-section">
        <div class="section-title">预览（前3个文件）</div>
        <rename-preview
          .files=${this.files.slice(0, 3)}
          .rule=${this.getCurrentRuleConfig()}
        ></rename-preview>
      </div>
    `;
  }

  private renderFooter() {
    return html`
      <div class="dialog-footer">
        <button class="button button-default" @click=${this.handleClose}>
          取消
        </button>
        <button class="button button-primary" @click=${this.handleConfirm}>
          执行重命名
        </button>
      </div>
    `;
  }

  private handleOverlayClick(e: Event) {
    if (e.target === e.currentTarget) {
      this.handleClose();
    }
  }

  private stopPropagation(e: Event) {
    e.stopPropagation();
  }

  private handleClose() {
    this.dispatchEvent(
      new CustomEvent('dialog-close', {
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleConfirm() {
    const ruleConfig = this.getCurrentRuleConfig();

    this.dispatchEvent(
      new CustomEvent('dialog-confirm', {
        bubbles: true,
        composed: true,
        detail: {
          ruleConfig,
        },
      })
    );
  }

  private handleRuleChange(ruleType: RuleType) {
    this.selectedRuleType = ruleType;

    // 重置参数为默认值
    switch (ruleType) {
      case 'replace':
        this.ruleParams = { search: '', replace: '', caseSensitive: false, global: true };
        break;
      case 'prefix':
        this.ruleParams = { prefix: '', separator: '' };
        break;
      case 'suffix':
        this.ruleParams = { suffix: '', separator: '' };
        break;
      case 'numbering':
        this.ruleParams = {
          startNumber: 1,
          digits: 3,
          position: 'prefix',
          format: '{num}',
          separator: '-',
        };
        break;
      case 'sanitize':
        this.ruleParams = { removeIllegal: true, removeChars: '' };
        break;
    }
  }

  private updateParam(key: string, value: any) {
    this.ruleParams = {
      ...this.ruleParams,
      [key]: value,
    };
  }

  private getCurrentRuleConfig(): RuleConfig {
    return {
      type: this.selectedRuleType,
      params: this.ruleParams,
    };
  }
}

// 声明模块以支持 TypeScript
declare global {
  interface HTMLElementTagNameMap {
    'rename-dialog': RenameDialog;
  }
}
