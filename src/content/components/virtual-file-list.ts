import { LitElement, html, css, type PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { virtualize, virtualizerRef } from '@lit-labs/virtualizer/virtualize.js';
import { FileItem } from '../../types/platform';
import { I18nService } from '../../utils/i18n';

/**
 * Virtual File List Component
 * Renders a virtualized list of files for optimal performance with large datasets
 *
 * @fires file-toggle - Dispatched when a file's checkbox is toggled
 * @fires file-click - Dispatched when a file is clicked
 *
 * @example
 * ```html
 * <virtual-file-list
 *   .files=${files}
 *   .uncheckList=${uncheckList}
 *   @file-toggle=${this.handleFileToggle}>
 * </virtual-file-list>
 * ```
 */
@customElement('virtual-file-list')
export class VirtualFileList extends LitElement {
  private static readonly VIRTUALIZE_MIN_ITEMS = 200;

  /**
   * Array of files to display
   */
  @property({ type: Array })
  files: FileItem[] = [];

  /**
   * Set of file IDs that are unchecked (reverse storage pattern)
   */
  @property({ type: Object })
  uncheckList: Set<string> = new Set();

  /**
   * Whether the list is disabled
   */
  @property({ type: Boolean })
  disabled = false;

  /**
   * Track if virtualizer has been initialized for current data
   * @private
   */
  private _virtualizerInitialized = false;
  private _filesKey: string | null = null;

  private shouldVirtualize(): boolean {
    return this.files.length > VirtualFileList.VIRTUALIZE_MIN_ITEMS;
  }

  private computeFilesKey(files: FileItem[]): string {
    const len = files.length;
    if (len === 0) return '0';

    const sample = [
      files[0]?.id,
      files[1]?.id,
      files[2]?.id,
      files[len - 3]?.id,
      files[len - 2]?.id,
      files[len - 1]?.id,
    ]
      .filter(Boolean)
      .join('|');

    return `${len}:${sample}`;
  }

  private kickVirtualizer(): void {
    const host = this.renderRoot.querySelector('.file-list') as HTMLElement | null;
    if (!host) return;

    const virtualizer = (host as any)[virtualizerRef] as { _hostElementSizeChanged?: () => void } | undefined;
    if (!virtualizer || typeof virtualizer._hostElementSizeChanged !== 'function') return;

    virtualizer._hostElementSizeChanged();
  }

  /**
   * Handle checkbox toggle
   * @private
   */
  private handleToggle(fileId: string, e: Event): void {
    e.stopPropagation();

    this.dispatchEvent(
      new CustomEvent('file-toggle', {
        detail: { fileId },
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * Handle file row click
   * @private
   */
  private handleFileClick(fileId: string): void {
    this.dispatchEvent(
      new CustomEvent('file-click', {
        detail: { fileId },
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * Render a single file item
   * @private
   */
  private renderFileItem(file: FileItem): any {
    const isChecked = !this.uncheckList.has(file.id);

    return html`
      <div
        class="file-item ${isChecked ? 'checked' : ''}"
        @click=${() => this.handleFileClick(file.id)}
      >
        <label class="file-checkbox" @click=${(e: Event) => e.stopPropagation()}>
          <input
            type="checkbox"
            .checked=${isChecked}
            ?disabled=${this.disabled}
            @change=${(e: Event) => this.handleToggle(file.id, e)}
          />
          <span class="checkbox-custom"></span>
        </label>

        <div class="file-info">
          <div class="file-name" title=${file.name}>
            ${file.name}
          </div>
          <div class="file-meta">
            ${this.formatFileSize(file.size)}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Format file size
   * @private
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Handle property updates with virtualizer initialization
   * @private
   */
  protected updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);

    if (changedProperties.has('files') && this.files.length > 0) {
      const nextKey = this.computeFilesKey(this.files);
      if (nextKey !== this._filesKey) {
        this._filesKey = nextKey;
        this._virtualizerInitialized = false;
      }

      if (!this.shouldVirtualize()) {
        return;
      }

      // CRITICAL FIX: Safely refresh virtualizer when files change
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
    } else if (this.files.length === 0) {
      // Reset flag when files are cleared
      this._virtualizerInitialized = false;
      this._filesKey = null;
    }
  }

  render() {
    if (this.files.length === 0) {
      return html`
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
          <p>${I18nService.t('no_files_found')}</p>
        </div>
      `;
    }

    return html`
      <div class="file-list">
        ${this.shouldVirtualize()
          ? virtualize({
              items: this.files,
              keyFunction: (file) => file.id,
              renderItem: (file) => this.renderFileItem(file),
            })
          : this.files.map((file) => this.renderFileItem(file))}
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
      height: 100%;
      overflow: auto;
    }

    .file-list {
      height: 100%;
      min-height: 0;
      padding: 8px;
      box-sizing: border-box;
    }

    .file-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      border-radius: 4px;
      cursor: pointer;
      transition: background-color 0.2s;
      border-bottom: 1px solid var(--cdr-border, #f0f0f0);
    }

    .file-item:hover {
      background: var(--cdr-surface-hover, #f5f5f5);
    }

    .file-item.checked {
      background: var(--cdr-selection-bg, #e6f7ff);
    }

    .file-item.checked:hover {
      background: var(--cdr-selection-hover-bg, #bae7ff);
    }

    .file-checkbox {
      display: flex;
      align-items: center;
      cursor: pointer;
      position: relative;
      flex-shrink: 0;
    }

    .file-checkbox input[type='checkbox'] {
      position: absolute;
      opacity: 0;
      width: 0;
      height: 0;
    }

    .checkbox-custom {
      display: inline-block;
      width: 18px;
      height: 18px;
      border: 2px solid var(--cdr-border-strong, #d9d9d9);
      border-radius: 4px;
      transition: all 0.2s;
      position: relative;
    }

    .file-checkbox input[type='checkbox']:checked + .checkbox-custom {
      background: var(--cdr-primary, #1890ff);
      border-color: var(--cdr-primary, #1890ff);
    }

    .file-checkbox input[type='checkbox']:checked + .checkbox-custom::after {
      content: '';
      position: absolute;
      left: 5px;
      top: 2px;
      width: 4px;
      height: 8px;
      border: solid white;
      border-width: 0 2px 2px 0;
      transform: rotate(45deg);
    }

    .file-checkbox input[type='checkbox']:disabled + .checkbox-custom {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .file-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .file-name {
      font-size: 14px;
      color: var(--cdr-text, #262626);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .file-meta {
      font-size: 12px;
      color: var(--cdr-text-tertiary, #8c8c8c);
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--cdr-text-tertiary, #8c8c8c);
      gap: 16px;
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
    'virtual-file-list': VirtualFileList;
  }
}
