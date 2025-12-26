import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { virtualize } from '@lit-labs/virtualizer/virtualize.js';
import { PreviewItem } from '../../types/file-selector';

/**
 * Virtual Preview List Component
 * Renders a virtualized list of preview items showing rename results
 *
 * @example
 * ```html
 * <virtual-preview-list
 *   .items=${previewItems}>
 * </virtual-preview-list>
 * ```
 */
@customElement('virtual-preview-list')
export class VirtualPreviewList extends LitElement {
  /**
   * Array of preview items to display
   */
  @property({ type: Array })
  items: PreviewItem[] = [];

  /**
   * Render a single preview item
   * @private
   */
  private renderPreviewItem(item: PreviewItem): any {
    const hasChange = item.newName !== item.file.name;
    const statusClass = item.conflict
      ? 'conflict'
      : item.error
      ? 'error'
      : item.done
      ? 'success'
      : '';

    return html`
      <div class="preview-item ${statusClass}">
        <div class="preview-status">
          ${this.renderStatusIcon(item)}
        </div>

        <div class="preview-content">
          <div class="original-name" title=${item.file.name}>
            ${item.file.name}
          </div>

          ${hasChange
            ? html`
                <div class="arrow">→</div>
                <div class="new-name ${statusClass}" title=${item.newName}>
                  ${item.newName}
                  ${item.conflict
                    ? html`<span class="conflict-badge">⚠️ 冲突</span>`
                    : ''}
                </div>
              `
            : html`<div class="no-change">(无变化)</div>`}
        </div>
      </div>
    `;
  }

  /**
   * Render status icon based on item state
   * @private
   */
  private renderStatusIcon(item: PreviewItem): any {
    if (item.done) {
      return html`
        <svg class="icon-success" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      `;
    }

    if (item.error) {
      return html`
        <svg class="icon-error" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
      `;
    }

    if (item.conflict) {
      return html`
        <svg class="icon-warning" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      `;
    }

    return html`
      <div class="checkbox-placeholder"></div>
    `;
  }

  render() {
    if (this.items.length === 0) {
      return html`
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          <p>选择文件并配置规则以查看预览</p>
        </div>
      `;
    }

    return html`
      <div class="preview-list">
        ${virtualize({
          items: this.items,
          renderItem: (item) => this.renderPreviewItem(item),
        })}
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
      height: 100%;
      overflow: auto;
    }

    .preview-list {
      padding: 8px;
    }

    .preview-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px;
      border-radius: 4px;
      border-bottom: 1px solid #f0f0f0;
      transition: background-color 0.2s;
    }

    .preview-item:hover {
      background: #f5f5f5;
    }

    .preview-item.conflict {
      background: #fff2e8;
      border-left: 3px solid #fa8c16;
    }

    .preview-item.error {
      background: #fff1f0;
      border-left: 3px solid #ff4d4f;
    }

    .preview-item.success {
      background: #f6ffed;
      border-left: 3px solid #52c41a;
    }

    .preview-status {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: 2px;
    }

    .icon-success {
      width: 18px;
      height: 18px;
      color: #52c41a;
      stroke-width: 2;
    }

    .icon-error {
      width: 18px;
      height: 18px;
      color: #ff4d4f;
      stroke-width: 2;
    }

    .icon-warning {
      width: 18px;
      height: 18px;
      color: #fa8c16;
      stroke-width: 2;
    }

    .checkbox-placeholder {
      width: 18px;
      height: 18px;
      border: 2px solid #d9d9d9;
      border-radius: 50%;
    }

    .preview-content {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .original-name {
      font-size: 14px;
      color: #595959;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .arrow {
      font-size: 14px;
      color: #8c8c8c;
      margin: 4px 0;
    }

    .new-name {
      font-size: 14px;
      color: #262626;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .new-name.conflict {
      color: #fa8c16;
    }

    .new-name.error {
      color: #ff4d4f;
    }

    .new-name.success {
      color: #52c41a;
    }

    .conflict-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      background: #fff7e6;
      border: 1px solid #ffd591;
      border-radius: 12px;
      font-size: 12px;
      color: #fa8c16;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .no-change {
      font-size: 14px;
      color: #8c8c8c;
      font-style: italic;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #8c8c8c;
      gap: 16px;
      padding: 32px;
      text-align: center;
    }

    .empty-state svg {
      width: 64px;
      height: 64px;
      stroke-width: 1.5;
    }

    .empty-state p {
      margin: 0;
      font-size: 14px;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'virtual-preview-list': VirtualPreviewList;
  }
}
