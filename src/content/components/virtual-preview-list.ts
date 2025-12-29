import { LitElement, html, css, type PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { virtualize, virtualizerRef } from '@lit-labs/virtualizer/virtualize.js';
import { PreviewItem } from '../../types/file-selector';
import { I18nService } from '../../utils/i18n';

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
  private static readonly VIRTUALIZE_MIN_ITEMS = 200;

  /**
   * Array of preview items to display
   */
  @property({ type: Array })
  items: PreviewItem[] = [];

  /**
   * Whether to show per-item execution status badges
   */
  @property({ type: Boolean })
  showStatus = false;

  /**
   * Track if virtualizer has been initialized for current data
   * @private
   */
  private _virtualizerInitialized = false;
  private _itemsKey: string | null = null;

  private shouldVirtualize(): boolean {
    return this.items.length > VirtualPreviewList.VIRTUALIZE_MIN_ITEMS;
  }

  private computeItemsKey(items: PreviewItem[]): string {
    const len = items.length;
    if (len === 0) return '0';

    const sample = [
      items[0]?.file?.id,
      items[1]?.file?.id,
      items[2]?.file?.id,
      items[len - 3]?.file?.id,
      items[len - 2]?.file?.id,
      items[len - 1]?.file?.id,
    ]
      .filter(Boolean)
      .join('|');

    return `${len}:${sample}`;
  }

  private kickVirtualizer(): void {
    const host = this.renderRoot.querySelector('.preview-list') as HTMLElement | null;
    if (!host) return;

    const virtualizer = (host as any)[virtualizerRef] as { _hostElementSizeChanged?: () => void } | undefined;
    if (!virtualizer || typeof virtualizer._hostElementSizeChanged !== 'function') return;

    virtualizer._hostElementSizeChanged();
  }

  /**
   * Render a single preview item
   * @private
   */
  private renderPreviewItem(item: PreviewItem): any {
    const statusClass = item.conflict
      ? 'conflict'
      : item.error
      ? 'error'
      : item.done
      ? 'success'
      : this.showStatus
        ? 'pending'
        : '';

    const statusBadge = item.conflict
      ? html`<span class="status-badge conflict">⚠️ ${I18nService.t('preview_badge_conflict')}</span>`
      : item.error
        ? html`<span class="status-badge error" title=${item.error}>${I18nService.t('progress_failed')}</span>`
        : item.done
          ? html`<span class="status-badge success">${I18nService.t('progress_success')}</span>`
          : this.showStatus
            ? html`<span class="status-badge pending">${I18nService.t('status_pending')}</span>`
            : '';

    return html`
      <div class="preview-item ${statusClass}">
        <div class="preview-content">
          <div class="new-name ${statusClass}" title=${item.newName}>
            ${item.newName}
            ${statusBadge}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Handle property updates with virtualizer initialization
   * @private
   */
  protected updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);

    if (changedProperties.has('items') && this.items.length > 0) {
      const nextKey = this.computeItemsKey(this.items);
      if (nextKey !== this._itemsKey) {
        this._itemsKey = nextKey;
        this._virtualizerInitialized = false;
      }

      if (!this.shouldVirtualize()) {
        return;
      }

      // CRITICAL FIX: Safely refresh virtualizer when items change
      // Only do this once per data load to prevent infinite loops
      if (!this._virtualizerInitialized) {
        this._virtualizerInitialized = true;

        // Delay to next frame to ensure layout is stable
        // Double RAF ensures virtualizer has time to calculate viewport height
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            this.kickVirtualizer();
          });
        });
      }
    } else if (this.items.length === 0) {
      // Reset flag when items are cleared
      this._virtualizerInitialized = false;
      this._itemsKey = null;
    }
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
        ${this.shouldVirtualize()
          ? virtualize({
              items: this.items,
              keyFunction: (item) => item.file.id,
              renderItem: (item) => this.renderPreviewItem(item),
            })
          : this.items.map((item) => this.renderPreviewItem(item))}
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
      height: 100%;
      min-height: 0;
      padding: 8px;
      box-sizing: border-box;
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

    .preview-item.pending {
      background: #fafafa;
      border-left: 3px solid #d9d9d9;
    }

    .preview-content {
      flex: 1;
      min-width: 0;
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

    .new-name.pending {
      color: #595959;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .status-badge.conflict {
      background: #fff7e6;
      border: 1px solid #ffd591;
      color: #fa8c16;
    }

    .status-badge.error {
      background: #fff1f0;
      border: 1px solid #ffa39e;
      color: #cf1322;
    }

    .status-badge.success {
      background: #f6ffed;
      border: 1px solid #b7eb8f;
      color: #389e0d;
    }

    .status-badge.pending {
      background: #f5f5f5;
      border: 1px solid #d9d9d9;
      color: #595959;
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
