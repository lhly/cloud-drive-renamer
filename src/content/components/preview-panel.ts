import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { PreviewItem } from '../../types/file-selector';
import { DEFAULT_EPISODE_EXTRACT_ASSIST_STATE, type EpisodeExtractAssistState } from '../../types/rule-preset';
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
  private getFailureNavigationState() {
    const failureItems = this.items.filter((item) => Boolean(item.error));
    const currentId = this.episodeExtractAssistState.suggestedFailureFileId;
    const currentIndex = failureItems.findIndex((item) => item.file.id === currentId);
    const normalizedIndex = failureItems.length === 0 ? -1 : currentIndex >= 0 ? currentIndex : 0;

    return {
      failureItems,
      normalizedIndex,
      currentItem: normalizedIndex >= 0 ? failureItems[normalizedIndex] : null,
      previousItem: normalizedIndex > 0 ? failureItems[normalizedIndex - 1] : null,
      nextItem: normalizedIndex >= 0 && normalizedIndex < failureItems.length - 1 ? failureItems[normalizedIndex + 1] : null,
    };
  }

  private emitAssistFocusFailure(fileId: string): void {
    this.dispatchEvent(
      new CustomEvent('episode-assist-focus-failure', {
        detail: { fileId },
        bubbles: true,
        composed: true,
      })
    );
  }

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

  @property({ type: Boolean })
  episodeExtractAssistEnabled = false;

  @property({ attribute: false })
  episodeExtractAssistState: EpisodeExtractAssistState = DEFAULT_EPISODE_EXTRACT_ASSIST_STATE;

  private renderFailureNavigation() {
    if (!this.episodeExtractAssistEnabled) {
      return null;
    }

    const { failureItems, normalizedIndex, previousItem, nextItem } = this.getFailureNavigationState();
    if (failureItems.length === 0) {
      return null;
    }

    const currentPosition = normalizedIndex >= 0 ? normalizedIndex + 1 : 0;

    return html`
      <div class="failure-nav" data-role="episode-assist-failure-nav">
        <div class="failure-nav-summary" data-role="episode-assist-failure-nav-summary">
          <span class="failure-nav-label">${I18nService.t('episode_assist_failure_nav_label')}</span>
          <span class="failure-nav-position">${currentPosition} / ${failureItems.length}</span>
        </div>
        <div class="failure-nav-actions">
          <button
            class="failure-nav-button"
            data-role="episode-assist-prev-failure"
            ?disabled=${!previousItem}
            @click=${() => previousItem && this.emitAssistFocusFailure(previousItem.file.id)}
          >
            ${I18nService.t('episode_assist_prev_failure')}
          </button>
          <button
            class="failure-nav-button"
            data-role="episode-assist-next-failure"
            ?disabled=${!nextItem}
            @click=${() => nextItem && this.emitAssistFocusFailure(nextItem.file.id)}
          >
            ${I18nService.t('episode_assist_next_failure')}
          </button>
        </div>
      </div>
    `;
  }

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

        ${this.renderFailureNavigation()}

        <div class="list-container">
          ${this.loading
            ? html`
                <div class="loading-state">
                  <div class="spinner"></div>
                  <p>${I18nService.t('preview_loading')}</p>
                </div>
              `
            : html`
                <virtual-preview-list
                  .items=${this.items}
                  .showStatus=${this.showStatus}
                  .episodeExtractAssistEnabled=${this.episodeExtractAssistEnabled}
                  .episodeExtractAssistState=${this.episodeExtractAssistState}
                ></virtual-preview-list>
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
      padding: 12px 16px;
      border-bottom: 1px solid var(--cdr-border, #f0f0f0);
      flex-shrink: 0;
    }

    .panel-title {
      margin: 0;
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
      align-items: center;
      gap: 12px;
      height: 48px;
      padding: 8px 16px;
      background: var(--cdr-surface-muted, #fafafa);
      border-bottom: 1px solid var(--cdr-border, #f0f0f0);
      box-sizing: border-box;
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

    .failure-nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      height: 48px;
      padding: 6px 16px;
      background: var(--cdr-info-bg, #e6f4ff);
      border-bottom: 1px solid var(--cdr-info-border, #91caff);
      box-sizing: border-box;
      flex-shrink: 0;
    }

    .failure-nav-summary {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      color: var(--cdr-info-text, #0958d9);
      font-size: 13px;
      font-weight: 500;
    }

    .failure-nav-label {
      color: var(--cdr-text, #262626);
    }

    .failure-nav-position {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 2px 6px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.7);
      border: 1px solid rgba(9, 88, 217, 0.18);
      white-space: nowrap;
    }

    .failure-nav-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    .failure-nav-button {
      height: 32px;
      border: 1px solid var(--cdr-border, #d9d9d9);
      background: var(--cdr-surface, #fff);
      color: var(--cdr-text, #262626);
      border-radius: 8px;
      padding: 4px 10px;
      font-size: 12px;
      cursor: pointer;
    }

    .failure-nav-button:disabled {
      opacity: 0.45;
      cursor: not-allowed;
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
