import { LitElement, html, css, type PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { virtualize, virtualizerRef } from '@lit-labs/virtualizer/virtualize.js';
import { PreviewItem } from '../../types/file-selector';
import { DEFAULT_EPISODE_EXTRACT_ASSIST_STATE, type EpisodeExtractAssistState } from '../../types/rule-preset';
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

  @property({ type: Boolean })
  episodeExtractAssistEnabled = false;

  @property({ attribute: false })
  episodeExtractAssistState: EpisodeExtractAssistState = DEFAULT_EPISODE_EXTRACT_ASSIST_STATE;

  /**
   * Track if virtualizer has been initialized for current data
   * @private
   */
  private _virtualizerInitialized = false;
  private _itemsKey: string | null = null;
  private _lastFocusedFailureId: string | null = null;

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
  private isTranslationCandidate(error: string): boolean {
    return /^[a-z0-9_]+$/.test(error);
  }

  private resolveErrorText(error?: string): string | undefined {
    if (!error) return undefined;

    if (!this.isTranslationCandidate(error)) {
      return error;
    }

    const translationKey = `error_${error}`;
    const translated = I18nService.t(translationKey);

    return translated === translationKey ? error : translated;
  }

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

    const errorText = this.resolveErrorText(item.error);
    const errorTitle = item.error ?? errorText ?? '';
    const conflictHint = item.conflict
      ? html`<span class="conflict-hint">${I18nService.t('error_api_conflict')}</span>`
      : '';
    const isSuggestedFailure =
      this.episodeExtractAssistEnabled &&
      this.episodeExtractAssistState.suggestedFailureFileId === item.file.id;
    const previewItemClasses = ['preview-item', statusClass, isSuggestedFailure ? 'assist-focus' : '']
      .filter(Boolean)
      .join(' ');
    const newNameClasses = ['new-name', 'new-name-primary', statusClass].filter(Boolean).join(' ');

    return html`
      <div class="${previewItemClasses}" data-file-id=${item.file.id}>
        <div class="preview-content">
          <div class="old-name-row">
            <div class="old-name old-name-secondary" title=${item.file.name}>
              ${item.file.name}
            </div>
            ${statusBadge}
          </div>
          <div class="${newNameClasses}" title=${item.newName}>
            <span class="new-name-text">${item.newName}</span>
            ${conflictHint}
          </div>
          ${
            errorText
              ? html`<div class="error-message" title=${errorTitle}>${errorText}</div>`
              : ''
          }
          ${isSuggestedFailure
            ? html`<div class="assist-focus-hint" data-role="episode-assist-focus-hint">${I18nService.t('episode_assist_focus_hint')}</div>`
            : ''}
          ${this.renderAssistActions(item)}
        </div>
      </div>
    `;
  }

  private renderAssistActions(item: PreviewItem) {
    if (!this.episodeExtractAssistEnabled) {
      return null;
    }

    const fileNameWithoutExt = item.file.name.replace(new RegExp(`${item.file.ext.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), '');
    const segments = fileNameWithoutExt
      .split(/[\s._-]+/)
      .map((segment) => segment.trim())
      .filter(Boolean);

    return html`
      <div class="assist-actions" data-role="episode-assist-actions">
        <button
          class="assist-action-button"
          data-role="episode-assist-apply-full-name"
          @click=${() => this.emitAssistEvent('episode-assist-apply-full-name', { fileId: item.file.id, fileName: fileNameWithoutExt })}
        >
          ${I18nService.t('episode_assist_apply_full_name')}
        </button>

        ${this.episodeExtractAssistState.fillMode === 'segment'
          ? html`
              <div class="segment-list" data-role="episode-assist-segments">
                ${segments.map(
                  (segment, index) => html`
                    <button
                      class="segment-chip"
                      data-role="episode-assist-segment"
                      @click=${() =>
                        this.emitAssistEvent('episode-assist-apply-segment', {
                          fileId: item.file.id,
                          segment,
                          index,
                        })}
                    >
                      ${segment}
                    </button>
                  `
                )}
              </div>
            `
          : null}

        ${item.error
          ? html`
              <div class="assist-actions assist-actions-secondary" data-role="episode-assist-error-actions">
                <button
                  class="assist-action-button"
                  data-role="episode-assist-use-item-as-sample"
                  @click=${() =>
                    this.emitAssistEvent('episode-assist-use-item-as-sample', {
                      fileId: item.file.id,
                      fileName: item.file.name,
                    })}
                >
                  ${I18nService.t('episode_assist_use_item_as_sample')}
                </button>
                <button
                  class="assist-action-button"
                  data-role="episode-assist-use-prefix-from-item"
                  @click=${() =>
                    this.emitAssistEvent('episode-assist-use-prefix-from-item', {
                      fileId: item.file.id,
                      fileName: fileNameWithoutExt,
                    })}
                >
                  ${I18nService.t('episode_assist_use_prefix_from_item')}
                </button>
                <button
                  class="assist-action-button"
                  data-role="episode-assist-focus-segment-mode"
                  @click=${() => this.emitAssistEvent('episode-assist-focus-segment-mode', { fileId: item.file.id })}
                >
                  ${I18nService.t('episode_assist_focus_segment_mode')}
                </button>
              </div>
            `
          : null}
      </div>
    `;
  }

  private emitAssistEvent(name: string, detail: Record<string, unknown>) {
    this.dispatchEvent(
      new CustomEvent(name, {
        detail,
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * Handle property updates with virtualizer initialization
   * @private
   */
  protected updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);

    const suggestedFailureFileId = this.episodeExtractAssistState.suggestedFailureFileId;
    if (
      this.episodeExtractAssistEnabled &&
      suggestedFailureFileId &&
      suggestedFailureFileId !== this._lastFocusedFailureId &&
      (changedProperties.has('episodeExtractAssistState') || changedProperties.has('items'))
    ) {
      this._lastFocusedFailureId = suggestedFailureFileId;
      requestAnimationFrame(() => {
        const target = this.renderRoot.querySelector<HTMLElement>(`[data-file-id="${suggestedFailureFileId}"]`);
        if (target && typeof target.scrollIntoView === 'function') {
          target.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      });
    }

    if (!suggestedFailureFileId) {
      this._lastFocusedFailureId = null;
    }

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
          <p>${I18nService.t('preview_empty_hint')}</p>
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
      border-bottom: 1px solid var(--cdr-border, #f0f0f0);
      transition: background-color 0.2s;
    }

    .preview-item:hover {
      background: var(--cdr-surface-hover, #f5f5f5);
    }

    .preview-item.conflict {
      background: var(--cdr-warning-bg, #fff2e8);
      border-left: 3px solid var(--cdr-warning-text, #fa8c16);
    }

    .preview-item.error {
      background: var(--cdr-danger-bg, #fff1f0);
      border-left: 3px solid var(--cdr-danger, #ff4d4f);
    }

    .preview-item.success {
      background: var(--cdr-success-bg, #f6ffed);
      border-left: 3px solid var(--cdr-success, #52c41a);
    }

    .preview-item.pending {
      background: var(--cdr-surface-muted, #fafafa);
      border-left: 3px solid var(--cdr-border-strong, #d9d9d9);
    }

    .preview-item.assist-focus {
      box-shadow: inset 0 0 0 1px var(--cdr-primary, #1890ff), 0 0 0 2px rgba(24, 144, 255, 0.12);
    }

    .preview-content {
      flex: 1;
      min-width: 0;
    }

    .old-name-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }

    .old-name {
      font-size: 12px;
      color: var(--cdr-text-secondary, #595959);
    }

    .old-name.old-name-secondary {
      flex: 1 1 0;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .new-name {
      font-size: 14px;
      color: var(--cdr-text, #262626);
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .new-name-text {
      flex: 1 1 0;
      min-width: 0;
    }

    .new-name-primary .new-name-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .new-name.conflict {
      color: var(--cdr-warning-text, #fa8c16);
    }

    .new-name.error {
      color: var(--cdr-danger, #ff4d4f);
    }

    .new-name.success {
      color: var(--cdr-success, #52c41a);
    }

    .new-name.pending {
      color: var(--cdr-text-secondary, #595959);
    }

    .conflict-hint {
      font-size: 12px;
      color: var(--cdr-warning-text, #fa8c16);
      flex-shrink: 0;
    }

    .error-message {
      margin-top: 4px;
      font-size: 12px;
      line-height: 1.4;
      color: var(--cdr-danger-text, #cf1322);
      word-break: break-word;
    }

    .assist-focus-hint {
      margin-top: 6px;
      font-size: 12px;
      color: var(--cdr-info-text, #0958d9);
      background: var(--cdr-info-bg, #e6f4ff);
      border: 1px solid var(--cdr-info-border, #91caff);
      border-radius: 8px;
      padding: 6px 8px;
    }

    .assist-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }

    .assist-actions-secondary {
      margin-top: 6px;
    }

    .assist-action-button,
    .segment-chip {
      border: 1px solid var(--cdr-border-strong, #d9d9d9);
      background: var(--cdr-surface, #fff);
      color: var(--cdr-text-secondary, #595959);
      border-radius: 999px;
      padding: 4px 8px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .assist-action-button:hover,
    .segment-chip:hover {
      border-color: var(--cdr-primary, #1890ff);
      color: var(--cdr-primary, #1890ff);
    }

    .segment-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
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
      background: var(--cdr-warning-bg, #fff7e6);
      border: 1px solid var(--cdr-warning-border, #ffd591);
      color: var(--cdr-warning-text, #fa8c16);
    }

    .status-badge.error {
      background: var(--cdr-danger-bg, #fff1f0);
      border: 1px solid var(--cdr-danger-border, #ffa39e);
      color: var(--cdr-danger-text, #cf1322);
    }

    .status-badge.success {
      background: var(--cdr-success-bg, #f6ffed);
      border: 1px solid var(--cdr-success-border, #b7eb8f);
      color: var(--cdr-success-text, #389e0d);
    }

    .status-badge.pending {
      background: var(--cdr-surface-hover, #f5f5f5);
      border: 1px solid var(--cdr-border-strong, #d9d9d9);
      color: var(--cdr-text-secondary, #595959);
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--cdr-text-tertiary, #8c8c8c);
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
