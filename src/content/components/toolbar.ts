import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
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

  @state()
  private typeMenuOpen = false;

  private documentClickHandler: ((e: MouseEvent) => void) | null = null;
  private documentKeydownHandler: ((e: KeyboardEvent) => void) | null = null;

  connectedCallback() {
    super.connectedCallback();

    this.documentClickHandler = (e: MouseEvent) => {
      if (!this.typeMenuOpen) return;
      const path = e.composedPath();
      if (path.includes(this)) return;
      this.closeTypeMenu();
    };

    this.documentKeydownHandler = (e: KeyboardEvent) => {
      if (!this.typeMenuOpen) return;
      if (e.key !== 'Escape') return;
      e.preventDefault();
      this.closeTypeMenu({ focusButton: true });
    };

    document.addEventListener('click', this.documentClickHandler);
    document.addEventListener('keydown', this.documentKeydownHandler);
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    if (this.documentClickHandler) {
      document.removeEventListener('click', this.documentClickHandler);
      this.documentClickHandler = null;
    }
    if (this.documentKeydownHandler) {
      document.removeEventListener('keydown', this.documentKeydownHandler);
      this.documentKeydownHandler = null;
    }
  }

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
   * Handle type filter selection
   * @private
   */
  private selectType(type: FileType | 'all'): void {
    this.dispatchEvent(
      new CustomEvent('type-filter', {
        detail: { type },
        bubbles: true,
        composed: true,
      })
    );
  }

  private getTypeLabel(type: FileType | 'all'): string {
    switch (type) {
      case 'all':
        return I18nService.t('all_types');
      case 'video':
        return I18nService.t('type_video');
      case 'image':
        return I18nService.t('type_image');
      case 'audio':
        return I18nService.t('type_audio');
      case 'document':
        return I18nService.t('type_document');
      case 'other':
        return I18nService.t('type_other');
    }
  }

  private toggleTypeMenu(): void {
    if (this.disabled) return;
    this.typeMenuOpen = !this.typeMenuOpen;

    if (this.typeMenuOpen) {
      requestAnimationFrame(() => {
        const selected =
          this.shadowRoot?.querySelector<HTMLButtonElement>('.type-menu-item[data-selected="true"]') ||
          this.shadowRoot?.querySelector<HTMLButtonElement>('.type-menu-item');
        selected?.focus();
      });
    }
  }

  private closeTypeMenu(options?: { focusButton?: boolean }): void {
    if (!this.typeMenuOpen) return;
    this.typeMenuOpen = false;

    if (options?.focusButton) {
      requestAnimationFrame(() => {
        const button = this.shadowRoot?.getElementById('type-filter-button') as HTMLButtonElement | null;
        button?.focus();
      });
    }
  }

  private handleTypeMenuItemClick(type: FileType | 'all'): void {
    if (this.disabled) return;
    this.closeTypeMenu({ focusButton: true });
    this.selectType(type);
  }

  render() {
    const state = this.checkboxState;
    const typeOptions: Array<{ value: FileType | 'all'; label: string }> = [
      { value: 'all', label: I18nService.t('all_types') },
      { value: 'video', label: I18nService.t('type_video') },
      { value: 'image', label: I18nService.t('type_image') },
      { value: 'audio', label: I18nService.t('type_audio') },
      { value: 'document', label: I18nService.t('type_document') },
      { value: 'other', label: I18nService.t('type_other') },
    ];

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
	            <div class="type-select">
	              <button
	                class="type-button"
	                id="type-filter-button"
	                type="button"
	                aria-haspopup="menu"
	                aria-expanded=${this.typeMenuOpen ? 'true' : 'false'}
	                aria-label=${`${I18nService.t('filter_by_type')}: ${this.getTypeLabel(this.typeFilter)}`}
	                title=${`${I18nService.t('filter_by_type')}: ${this.getTypeLabel(this.typeFilter)}`}
	                data-active=${this.typeFilter === 'all' ? 'false' : 'true'}
	                ?disabled=${this.disabled}
	                @click=${this.toggleTypeMenu}
	              >
	                <span class="sr-only">${I18nService.t('filter_by_type')}</span>
	                <svg
	                  class="type-button-icon"
	                  viewBox="0 0 24 24"
	                  fill="none"
	                  stroke="currentColor"
	                  stroke-width="2"
	                  stroke-linecap="round"
	                  stroke-linejoin="round"
	                  aria-hidden="true"
	                  focusable="false"
	                >
	                  <polygon points="22 3 2 3 10 12 10 19 14 21 14 12 22 3"></polygon>
	                </svg>
	                <span class="type-button-text">${this.getTypeLabel(this.typeFilter)}</span>
	                <svg
	                  class="type-button-chevron"
	                  viewBox="0 0 20 20"
	                  fill="none"
	                  stroke="currentColor"
	                  stroke-width="2"
	                  stroke-linecap="round"
	                  stroke-linejoin="round"
	                  aria-hidden="true"
	                  focusable="false"
	                >
	                  <path d="M6 8l4 4 4-4"></path>
	                </svg>
	              </button>

	              <div class="type-menu" role="menu" aria-label=${I18nService.t('filter_by_type')} ?hidden=${!this.typeMenuOpen}>
                ${typeOptions.map(({ value, label }) => {
                  const selected = value === this.typeFilter;
                  return html`
                    <button
                      class="type-menu-item"
                      type="button"
                      role="menuitemradio"
                      aria-checked=${selected ? 'true' : 'false'}
                      data-selected=${selected ? 'true' : 'false'}
                      @click=${() => this.handleTypeMenuItemClick(value)}
                    >
                      ${label}
                    </button>
                  `;
                })}
              </div>
            </div>
          </div>
        </div>

        <div class="toolbar-right">
          <span class="selected-count">
            ${I18nService.t('selected_files_count', [String(this.selectedCount), String(this.totalCount)])}
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
      background: var(--cdr-surface-muted, #fafafa);
      border-bottom: 1px solid var(--cdr-border, #f0f0f0);
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
      border: 2px solid var(--cdr-border-strong, #d9d9d9);
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--cdr-surface, #fff);
      transition: all 0.2s;
      flex-shrink: 0;
      position: relative;
    }

    .checkbox-label:not(.disabled):hover .checkbox {
      border-color: var(--cdr-primary, #1890ff);
    }

    .checkbox.all,
    .checkbox.partial {
      border-color: var(--cdr-primary, #1890ff);
      background: var(--cdr-primary, #1890ff);
      color: #fff;
    }

    .checkbox.none {
      background: var(--cdr-surface, #fff);
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
      color: var(--cdr-text, #262626);
      white-space: nowrap;
    }

    .checkbox-label.disabled .checkbox-text {
      color: var(--cdr-text-disabled, #bfbfbf);
    }

	    .filter-group {
	      display: flex;
	      align-items: center;
	      gap: 8px;
	    }

	    .sr-only {
	      position: absolute;
	      width: 1px;
	      height: 1px;
	      padding: 0;
	      margin: -1px;
	      overflow: hidden;
	      clip: rect(0, 0, 0, 0);
	      white-space: nowrap;
	      border: 0;
	    }

	    .type-select {
	      position: relative;
	      display: inline-flex;
	      align-items: center;
	      flex-shrink: 0;
	    }

	    .type-button {
	      width: auto;
	      height: 32px;
	      padding: 0 10px 0 8px;
	      border: 1px solid var(--cdr-border-strong, #d9d9d9);
	      border-radius: 6px;
	      color: var(--cdr-text, #262626);
	      background: var(--cdr-surface, #fff);
	      cursor: pointer;
	      transition: all 0.2s;
	      display: inline-flex;
	      align-items: center;
	      justify-content: flex-start;
	      gap: 6px;
	      min-width: 0;
	    }

	    .type-button:hover:not(:disabled) {
	      background: var(--cdr-surface-hover, #f5f5f5);
	      border-color: var(--cdr-primary, #1890ff);
	    }

	    .type-button[data-active='true']:hover:not(:disabled) {
	      background: var(--cdr-selection-hover-bg, rgba(24, 144, 255, 0.12));
	    }

	    .type-button:focus-visible {
	      outline: none;
	      border-color: var(--cdr-primary, #1890ff);
	      box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
	    }

	    .type-button:disabled {
	      cursor: not-allowed;
	      opacity: 0.45;
	    }

	    .type-button[data-active='true'] {
	      border-color: var(--cdr-primary, #1890ff);
	      background: var(--cdr-selection-bg, rgba(24, 144, 255, 0.08));
	      color: var(--cdr-primary, #1890ff);
	    }

	    .type-button-icon {
	      width: 16px;
	      height: 16px;
	      flex-shrink: 0;
	      opacity: 0.9;
	    }

	    .type-button-text {
	      font-size: 13px;
	      overflow: hidden;
	      text-overflow: ellipsis;
	      white-space: nowrap;
	      max-width: 96px;
	      min-width: 0;
	    }

	    .type-button-chevron {
	      width: 14px;
	      height: 14px;
	      flex-shrink: 0;
	      opacity: 0.8;
	    }

	    .type-menu {
	      position: absolute;
	      top: calc(100% + 6px);
	      left: 0;
	      width: 180px;
	      padding: 6px;
	      background: var(--cdr-surface, #fff);
	      border: 1px solid var(--cdr-border-strong, #d9d9d9);
	      border-radius: 8px;
	      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
	      z-index: 1000;
	    }

    .type-menu-item {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 10px;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: var(--cdr-text, #262626);
      font-size: 13px;
      cursor: pointer;
      transition: background 0.2s, color 0.2s;
    }

    .type-menu-item::after {
      content: '';
      width: 16px;
      text-align: right;
      color: var(--cdr-primary, #1890ff);
      font-size: 12px;
      line-height: 1;
      flex-shrink: 0;
    }

    .type-menu-item:hover {
      background: var(--cdr-surface-hover, #f5f5f5);
    }

    .type-menu-item:focus-visible {
      outline: none;
      box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
    }

    .type-menu-item[data-selected='true'] {
      background: var(--cdr-selection-bg, rgba(24, 144, 255, 0.08));
      color: var(--cdr-primary, #1890ff);
    }

    .type-menu-item[data-selected='true']::after {
      content: '✓';
    }

    .selected-count {
      font-size: 14px;
      color: var(--cdr-text-secondary, #595959);
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
