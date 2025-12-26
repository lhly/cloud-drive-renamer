import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { FileType } from '../../types/file-selector';
import { I18nService } from '../../utils/i18n';

/**
 * Toolbar Component
 * Provides file selection controls and type filter
 *
 * @fires select-all - Dispatched when select all button is clicked
 * @fires deselect-all - Dispatched when deselect all button is clicked
 * @fires type-filter - Dispatched when type filter changes
 *
 * @example
 * ```html
 * <file-toolbar
 *   .selectedCount=${5}
 *   .totalCount=${10}
 *   @select-all=${this.handleSelectAll}
 *   @deselect-all=${this.handleDeselectAll}
 *   @type-filter=${this.handleTypeFilter}>
 * </file-toolbar>
 * ```
 */
@customElement('file-toolbar')
export class Toolbar extends LitElement {
  /**
   * Number of selected files
   */
  @property({ type: Number })
  selectedCount = 0;

  /**
   * Total number of files
   */
  @property({ type: Number })
  totalCount = 0;

  /**
   * Current type filter
   */
  @property({ type: String })
  typeFilter: FileType | 'all' = 'all';

  /**
   * Whether controls are disabled
   */
  @property({ type: Boolean })
  disabled = false;

  /**
   * Handle select all button click
   * @private
   */
  private handleSelectAll(): void {
    this.dispatchEvent(
      new CustomEvent('select-all', {
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * Handle deselect all button click
   * @private
   */
  private handleDeselectAll(): void {
    this.dispatchEvent(
      new CustomEvent('deselect-all', {
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * Handle type filter change
   * @private
   */
  private handleTypeFilterChange(e: Event): void {
    const select = e.target as HTMLSelectElement;
    const type = select.value as FileType | 'all';

    this.dispatchEvent(
      new CustomEvent('type-filter', {
        detail: { type },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    return html`
      <div class="toolbar">
        <div class="toolbar-left">
          <button
            class="toolbar-button"
            @click=${this.handleSelectAll}
            ?disabled=${this.disabled}
            title=${I18nService.t('select_all')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>${I18nService.t('select_all')}</span>
          </button>

          <button
            class="toolbar-button"
            @click=${this.handleDeselectAll}
            ?disabled=${this.disabled}
            title=${I18nService.t('deselect_all')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            </svg>
            <span>${I18nService.t('deselect_all')}</span>
          </button>

          <div class="filter-group">
            <label class="filter-label">${I18nService.t('filter_by_type')}:</label>
            <select
              class="type-filter"
              .value=${this.typeFilter}
              @change=${this.handleTypeFilterChange}
              ?disabled=${this.disabled}
            >
              <option value="all">${I18nService.t('all_types')}</option>
              <option value="video">${I18nService.t('type_video')}</option>
              <option value="image">${I18nService.t('type_image')}</option>
              <option value="document">${I18nService.t('type_document')}</option>
              <option value="other">${I18nService.t('type_other')}</option>
            </select>
          </div>
        </div>

        <div class="toolbar-right">
          <span class="selected-count">
            已选择 ${this.selectedCount} / ${this.totalCount} 个文件
          </span>
        </div>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
    }

    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: #fafafa;
      border-bottom: 1px solid #f0f0f0;
      gap: 16px;
    }

    .toolbar-left {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
      min-width: 0;
    }

    .toolbar-right {
      display: flex;
      align-items: center;
      flex-shrink: 0;
    }

    .toolbar-button {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border: 1px solid #d9d9d9;
      background: #fff;
      border-radius: 4px;
      font-size: 14px;
      color: #262626;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
    }

    .toolbar-button:hover:not(:disabled) {
      color: #1890ff;
      border-color: #1890ff;
    }

    .toolbar-button:active:not(:disabled) {
      background: #f5f5f5;
    }

    .toolbar-button:disabled {
      color: #bfbfbf;
      cursor: not-allowed;
      opacity: 0.6;
    }

    .toolbar-button svg {
      width: 16px;
      height: 16px;
      stroke-width: 2;
    }

    .filter-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .filter-label {
      font-size: 14px;
      color: #595959;
      white-space: nowrap;
    }

    .type-filter {
      padding: 6px 12px;
      border: 1px solid #d9d9d9;
      border-radius: 4px;
      font-size: 14px;
      color: #262626;
      background: #fff;
      cursor: pointer;
      transition: all 0.2s;
      min-width: 120px;
    }

    .type-filter:hover:not(:disabled) {
      border-color: #1890ff;
    }

    .type-filter:focus {
      outline: none;
      border-color: #1890ff;
      box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
    }

    .type-filter:disabled {
      color: #bfbfbf;
      cursor: not-allowed;
      opacity: 0.6;
    }

    .selected-count {
      font-size: 14px;
      color: #595959;
      white-space: nowrap;
    }

    @media (max-width: 768px) {
      .toolbar {
        flex-direction: column;
        align-items: stretch;
      }

      .toolbar-left {
        flex-wrap: wrap;
      }

      .toolbar-right {
        justify-content: center;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'toolbar': Toolbar;
  }
}
