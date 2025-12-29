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
   * Computed: checkbox state
   * Returns 'all', 'none', or 'partial'
   * @private
   */
  private get checkboxState(): 'all' | 'none' | 'partial' {
    if (this.selectedCount === 0) return 'none';
    if (this.selectedCount === this.totalCount) return 'all';
    return 'partial';
  }

  /**
   * Handle checkbox click - toggles between select all and deselect all
   * @private
   */
  private handleCheckboxClick(): void {
    if (this.checkboxState === 'all') {
      // Currently all selected, deselect all
      this.dispatchEvent(
        new CustomEvent('deselect-all', {
          bubbles: true,
          composed: true,
        })
      );
    } else {
      // Currently none or partial selected, select all
      this.dispatchEvent(
        new CustomEvent('select-all', {
          bubbles: true,
          composed: true,
        })
      );
    }
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
    const state = this.checkboxState;

    return html`
      <div class="toolbar">
        <div class="toolbar-left">
          <label
            class="checkbox-label ${this.disabled ? 'disabled' : ''}"
            title=${state === 'all'
              ? I18nService.t('deselect_all')
              : I18nService.t('select_all')}
          >
            <div
              class="checkbox ${state}"
              @click=${this.disabled ? null : this.handleCheckboxClick}
            >
              ${state === 'all'
                ? html`
                    <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3 8L7 12L13 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  `
                : state === 'partial'
                ? html`
                    <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="3" y="7" width="10" height="2" fill="currentColor"/>
                    </svg>
                  `
                : ''}
            </div>
            <span class="checkbox-text">${I18nService.t('select_all_checkbox')}</span>
          </label>

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

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      user-select: none;
      transition: all 0.2s;
    }

    .checkbox-label.disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }

    .checkbox {
      width: 18px;
      height: 18px;
      border: 2px solid #d9d9d9;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fff;
      transition: all 0.2s;
      flex-shrink: 0;
      position: relative;
    }

    .checkbox-label:not(.disabled):hover .checkbox {
      border-color: #1890ff;
    }

    .checkbox.all,
    .checkbox.partial {
      border-color: #1890ff;
      background: #1890ff;
      color: #fff;
    }

    .checkbox.none {
      background: #fff;
      color: transparent;
    }

    /* Ensure partial state dash is visible even if SVG fails */
    .checkbox.partial::before {
      content: '';
      position: absolute;
      width: 10px;
      height: 2px;
      background: currentColor;
      border-radius: 1px;
    }

    .checkbox svg {
      width: 16px;
      height: 16px;
      position: relative;
      z-index: 1;
    }

    .checkbox-text {
      font-size: 14px;
      color: #262626;
      white-space: nowrap;
    }

    .checkbox-label.disabled .checkbox-text {
      color: #bfbfbf;
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
