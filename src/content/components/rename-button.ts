import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * 重命名按钮组件
 * 注入到夸克网盘工具栏的批量重命名按钮
 *
 * 使用方式:
 * <rename-button
 *   .disabled=${false}
 *   .selectedCount=${5}
 *   @rename-click=${handler}>
 * </rename-button>
 */
@customElement('rename-button')
export class RenameButton extends LitElement {
  /**
   * 按钮是否禁用
   */
  @property({ type: Boolean })
  disabled = true;

  /**
   * 选中文件数量
   */
  @property({ type: Number })
  selectedCount = 0;

  /**
   * 是否显示加载状态
   */
  @property({ type: Boolean })
  loading = false;

  static styles = css`
    :host {
      display: inline-block;
    }

    .rename-button {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background-color: #1890ff;
      color: #ffffff;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .rename-button:hover:not(:disabled) {
      background-color: #40a9ff;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
      transform: translateY(-1px);
    }

    .rename-button:active:not(:disabled) {
      background-color: #096dd9;
      transform: translateY(0);
    }

    .rename-button:disabled {
      background-color: #d9d9d9;
      color: rgba(0, 0, 0, 0.25);
      cursor: not-allowed;
      box-shadow: none;
    }

    .icon {
      width: 16px;
      height: 16px;
      fill: currentColor;
    }

    .loading-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid currentColor;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    .count {
      font-weight: 600;
      margin-left: 4px;
    }
  `;

  render() {
    return html`
      <button
        class="rename-button"
        ?disabled=${this.disabled || this.loading}
        @click=${this.handleClick}
        title=${this.getTooltip()}
      >
        ${this.loading ? this.renderLoadingIcon() : this.renderIcon()}
        <span>批量重命名</span>
        ${this.selectedCount > 0
          ? html`<span class="count">(${this.selectedCount})</span>`
          : ''}
      </button>
    `;
  }

  private renderIcon() {
    return html`
      <svg
        class="icon"
        viewBox="0 0 1024 1024"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M832 512c0-176-144-320-320-320S192 336 192 512s144 320 320 320 320-144 320-320z m-256 0h128v64H576v-64z m-128 0h64v64h-64v-64z m0-128h64v64h-64v-64z m128 0h128v64H576v-64z"
        />
      </svg>
    `;
  }

  private renderLoadingIcon() {
    return html`<div class="loading-spinner"></div>`;
  }

  private handleClick() {
    if (this.disabled || this.loading) {
      return;
    }

    // 触发自定义事件
    this.dispatchEvent(
      new CustomEvent('rename-click', {
        bubbles: true,
        composed: true,
        detail: {
          selectedCount: this.selectedCount,
        },
      })
    );
  }

  private getTooltip(): string {
    if (this.loading) {
      return '处理中...';
    }

    if (this.selectedCount === 0) {
      return '请先选择要重命名的文件';
    }

    return `批量重命名 ${this.selectedCount} 个文件`;
  }
}

// 声明模块以支持 TypeScript
declare global {
  interface HTMLElementTagNameMap {
    'rename-button': RenameButton;
  }
}
