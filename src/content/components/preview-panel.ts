import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { PreviewItem } from '../../types/file-selector';
import { I18nService } from '../../utils/i18n';
import './virtual-preview-list';

/**
 * Preview Panel Component
 * Right panel that displays rename preview results
 *
 * @example
 * ```html
 * <preview-panel
 *   .items=${previewItems}
 *   .conflictCount=${conflictCount}>
 * </preview-panel>
 * ```
 */
@customElement('preview-panel')
export class PreviewPanel extends LitElement {
  /**
   * Array of preview items
   */
  @property({ type: Array })
  items: PreviewItem[] = [];

  /**
   * Number of conflicts detected
   */
  @property({ type: Number })
  conflictCount = 0;

  /**
   * Whether the panel is in loading state
   */
  @property({ type: Boolean })
  loading = false;

  /**
   * Whether to show execution status counters/badges
   */
  @property({ type: Boolean })
  showStatus = false;

  render() {
    const hasConflicts = this.conflictCount > 0;
    const successCount = this.items.filter((i) => i.done).length;
    const failedCount = this.items.filter((i) => Boolean(i.error)).length;
    const pendingCount = Math.max(0, this.items.length - successCount - failedCount);

    return html`
      <div class="preview-panel">
        <div class="panel-header">
          <h3 class="panel-title">${I18nService.t('preview_panel_title')}</h3>
          ${hasConflicts
            ? html`
                <div class="conflict-warning">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>
                  <span>${I18nService.t('conflicts_detected', [String(this.conflictCount)])}</span>
                </div>
              `
            : ''}
        </div>

        <div class="panel-stats">
          <div class="stat-item">
            <span class="stat-label">${I18nService.t('preview_items')}</span>
            <span class="stat-value">${this.items.length}</span>
          </div>
          ${this.showStatus
            ? html`
                <div class="stat-item">
                  <span class="stat-label">${I18nService.t('progress_remaining')}</span>
                  <span class="stat-value">${pendingCount}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">${I18nService.t('progress_success')}</span>
                  <span class="stat-value success">${successCount}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">${I18nService.t('progress_failed')}</span>
                  <span class="stat-value failed">${failedCount}</span>
                </div>
              `
            : ''}
          ${hasConflicts
            ? html`
                <div class="stat-item conflict">
                  <span class="stat-label">${I18nService.t('preview_summary_conflict')}</span>
                  <span class="stat-value">${this.conflictCount}</span>
                </div>
              `
            : ''}
        </div>

        <div class="list-container">
          ${this.loading
            ? html`
                <div class="loading-state">
                  <div class="spinner"></div>
                  <p>${I18nService.t('preview_loading')}</p>
                </div>
              `
            : html`
                <virtual-preview-list .items=${this.items} .showStatus=${this.showStatus}></virtual-preview-list>
              `}
        </div>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--cdr-surface, #fff);
    }

    .preview-panel {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .panel-header {
      padding: 16px;
      border-bottom: 1px solid var(--cdr-border, #f0f0f0);
      flex-shrink: 0;
    }

    .panel-title {
      margin: 0 0 8px 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--cdr-text, #262626);
    }

    .conflict-warning {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--cdr-warning-bg, #fff7e6);
      border: 1px solid var(--cdr-warning-border, #ffd591);
      border-radius: 4px;
      color: var(--cdr-warning-text, #fa8c16);
      font-size: 13px;
    }

    .conflict-warning svg {
      width: 16px;
      height: 16px;
      stroke-width: 2;
      flex-shrink: 0;
    }

    .panel-stats {
      display: flex;
      gap: 16px;
      padding: 12px 16px;
      background: var(--cdr-surface-muted, #fafafa);
      border-bottom: 1px solid var(--cdr-border, #f0f0f0);
      flex-shrink: 0;
    }

    .stat-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
    }

    .stat-label {
      color: var(--cdr-text-secondary, #595959);
    }

    .stat-value {
      color: var(--cdr-text, #262626);
      font-weight: 600;
    }

    .stat-item.conflict .stat-value {
      color: var(--cdr-warning-text, #fa8c16);
    }

    .stat-value.success {
      color: #52c41a;
    }

    .stat-value.failed {
      color: #ff4d4f;
    }

    .list-container {
      flex: 1;
      overflow: hidden;
      position: relative;
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 16px;
      color: var(--cdr-text-tertiary, #8c8c8c);
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid var(--cdr-border, #f0f0f0);
      border-top-color: var(--cdr-primary, #1890ff);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    .loading-state p {
      margin: 0;
      font-size: 14px;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'preview-panel': PreviewPanel;
  }
}
