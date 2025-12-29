import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { FileItem } from '../../types/platform';
import { FileType } from '../../types/file-selector';
import { I18nService } from '../../utils/i18n';
import './search-box';
import './toolbar';
import './virtual-file-list';

/**
 * File List Panel Component
 * Center panel that contains search, toolbar, and file list
 *
 * @fires search - Dispatched when search query changes
 * @fires select-all - Dispatched when select all is triggered
 * @fires deselect-all - Dispatched when deselect all is triggered
 * @fires type-filter - Dispatched when type filter changes
 * @fires file-toggle - Dispatched when file checkbox is toggled
 *
 * @example
 * ```html
 * <file-list-panel
 *   .files=${files}
 *   .uncheckList=${uncheckList}
 *   .selectedCount=${selectedCount}
 *   @search=${this.handleSearch}
 *   @file-toggle=${this.handleFileToggle}>
 * </file-list-panel>
 * ```
 */
@customElement('file-list-panel')
export class FileListPanel extends LitElement {
  /**
   * Array of files to display
   */
  @property({ type: Array })
  files: FileItem[] = [];

  /**
   * Set of file IDs that are unchecked
   */
  @property({ type: Object })
  uncheckList: Set<string> = new Set();

  /**
   * Current search query
   */
  @property({ type: String })
  searchQuery = '';

  /**
   * Current type filter
   */
  @property({ type: String })
  typeFilter: FileType | 'all' = 'all';

  /**
   * Number of selected files
   */
  @property({ type: Number })
  selectedCount = 0;

  /**
   * Whether the panel is in loading state
   */
  @property({ type: Boolean })
  loading = false;

  /**
   * Whether controls are disabled
   */
  @property({ type: Boolean })
  disabled = false;

  /**
   * Handle search event
   * @private
   */
  private handleSearch(e: CustomEvent): void {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('search', {
        detail: e.detail,
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * Handle select all event
   * @private
   */
  private handleSelectAll(e: Event): void {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('select-all', {
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * Handle deselect all event
   * @private
   */
  private handleDeselectAll(e: Event): void {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('deselect-all', {
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * Handle type filter event
   * @private
   */
  private handleTypeFilter(e: CustomEvent): void {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('type-filter', {
        detail: e.detail,
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * Handle file toggle event
   * @private
   */
  private handleFileToggle(e: CustomEvent): void {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('file-toggle', {
        detail: e.detail,
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    return html`
      <div class="file-list-panel">
        <div class="panel-header">
          <h3 class="panel-title">${I18nService.t('file_list_panel_title')}</h3>
        </div>

        <div class="search-container">
          <search-box
            .value=${this.searchQuery}
            ?disabled=${this.disabled || this.loading}
            @search=${this.handleSearch}
          ></search-box>
        </div>

        <file-toolbar
          .selectedCount=${this.selectedCount}
          .totalCount=${this.files.length}
          .typeFilter=${this.typeFilter}
          ?disabled=${this.disabled || this.loading}
          @select-all=${this.handleSelectAll}
          @deselect-all=${this.handleDeselectAll}
          @type-filter=${this.handleTypeFilter}
        ></file-toolbar>

        <div class="list-container">
          ${this.loading
            ? html`
                <div class="loading-state">
                  <div class="spinner"></div>
                  <p>${I18nService.t('loading_files')}</p>
                </div>
              `
            : html`
                <virtual-file-list
                  .files=${this.files}
                  .uncheckList=${this.uncheckList}
                  ?disabled=${this.disabled}
                  @file-toggle=${this.handleFileToggle}
                ></virtual-file-list>
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
      background: #fff;
      border-right: 1px solid #f0f0f0;
    }

    .file-list-panel {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .panel-header {
      padding: 16px;
      border-bottom: 1px solid #f0f0f0;
      flex-shrink: 0;
    }

    .panel-title {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #262626;
    }

    .search-container {
      padding: 12px 16px;
      border-bottom: 1px solid #f0f0f0;
      flex-shrink: 0;
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
      color: #8c8c8c;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #f0f0f0;
      border-top-color: #1890ff;
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
    'file-list-panel': FileListPanel;
  }
}
