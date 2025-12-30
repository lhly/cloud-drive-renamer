import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { debounce } from '../../utils/debounce';
import { I18nService } from '../../utils/i18n';

/**
 * Search Box Component
 * Provides real-time search with 300ms debounce
 *
 * @fires search - Dispatched when search query changes (debounced)
 * @fires search-clear - Dispatched when search is cleared
 *
 * @example
 * ```html
 * <search-box
 *   @search=${(e) => this.handleSearch(e.detail.query)}>
 * </search-box>
 * ```
 */
@customElement('search-box')
export class SearchBox extends LitElement {
  /**
   * Current search query
   */
  @property({ type: String })
  value = '';

  /**
   * Placeholder text
   */
  @property({ type: String })
  placeholder = '';

  /**
   * Whether the input is disabled
   */
  @property({ type: Boolean })
  disabled = false;

  /**
   * Internal input value (synced with input element)
   */
  @state()
  private inputValue = '';

  /**
   * Debounced search handler
   * @private
   */
  private debouncedSearch = debounce((query: string) => {
    this.dispatchEvent(
      new CustomEvent('search', {
        detail: { query },
        bubbles: true,
        composed: true,
      })
    );
  }, 300);

  connectedCallback() {
    super.connectedCallback();
    this.inputValue = this.value;
  }

  /**
   * Handle input change
   * @private
   */
  private handleInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.inputValue = input.value;
    this.debouncedSearch(input.value);
  }

  /**
   * Handle clear button click
   * @private
   */
  private handleClear(): void {
    this.inputValue = '';
    this.value = '';

    this.dispatchEvent(
      new CustomEvent('search', {
        detail: { query: '' },
        bubbles: true,
        composed: true,
      })
    );

    this.dispatchEvent(
      new CustomEvent('search-clear', {
        bubbles: true,
        composed: true,
      })
    );

    // Focus input after clearing
    const input = this.shadowRoot?.querySelector('input');
    input?.focus();
  }

  render() {
    const placeholderText = this.placeholder || I18nService.t('search_placeholder');

    return html`
      <div class="search-box">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
        <input
          type="text"
          class="search-input"
          .value=${this.inputValue}
          placeholder=${placeholderText}
          ?disabled=${this.disabled}
          @input=${this.handleInput}
        />
        ${this.inputValue
          ? html`
              <button
                class="clear-button"
                @click=${this.handleClear}
                ?disabled=${this.disabled}
                aria-label=${I18nService.t('clear_search')}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            `
          : ''}
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
    }

    .search-box {
      position: relative;
      display: flex;
      align-items: center;
      background: var(--cdr-surface, #fff);
      border: 1px solid var(--cdr-border-strong, #d9d9d9);
      border-radius: 4px;
      padding: 8px 12px;
      transition: all 0.3s;
    }

    .search-box:focus-within {
      border-color: #1890ff;
      box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
    }

    .search-icon {
      width: 16px;
      height: 16px;
      color: var(--cdr-text-tertiary, #8c8c8c);
      flex-shrink: 0;
      margin-right: 8px;
      stroke-width: 2;
    }

    .search-input {
      flex: 1;
      border: none;
      outline: none;
      font-size: 14px;
      color: var(--cdr-text, #262626);
      background: transparent;
      min-width: 0;
    }

    .search-input::placeholder {
      color: var(--cdr-text-disabled, #bfbfbf);
    }

    .search-input:disabled {
      color: var(--cdr-text-disabled, #bfbfbf);
      cursor: not-allowed;
    }

    .clear-button {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      padding: 0;
      border: none;
      background: transparent;
      cursor: pointer;
      color: var(--cdr-text-tertiary, #8c8c8c);
      flex-shrink: 0;
      margin-left: 4px;
      border-radius: 50%;
      transition: all 0.2s;
    }

    .clear-button:hover {
      background: var(--cdr-surface-hover, #f5f5f5);
      color: var(--cdr-text, #262626);
    }

    .clear-button:active {
      background: var(--cdr-border, #e8e8e8);
    }

    .clear-button:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    .clear-button svg {
      width: 14px;
      height: 14px;
      stroke-width: 2;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'search-box': SearchBox;
  }
}
