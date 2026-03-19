import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import {
  ConflictDetail,
  ConflictResolution,
  ConflictType,
} from '../../core/conflict-detector';
import { I18nService } from '../../utils/i18n';

@customElement('conflict-resolution-dialog')
export class ConflictResolutionDialog extends LitElement {
  @property({ type: Boolean })
  open = false;

  @property({ type: Number })
  conflictCount = 0;

  @property({ attribute: false })
  items: ConflictDetail[] = [];

  static styles = css`
    :host {
      position: fixed;
      inset: 0;
      z-index: 10001;
      pointer-events: none;
      font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .dialog-overlay {
      position: fixed;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      background: rgba(15, 23, 42, 0.48);
      pointer-events: auto;
      padding: 24px;
      box-sizing: border-box;
    }

    .dialog-overlay.open {
      display: flex;
    }

    .dialog {
      width: min(720px, 100%);
      max-height: min(80vh, 760px);
      background: #fff;
      color: #111827;
      border-radius: 18px;
      box-shadow: 0 24px 64px rgba(15, 23, 42, 0.24);
      border: 1px solid rgba(148, 163, 184, 0.2);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .dialog-header {
      padding: 20px 24px 12px;
      border-bottom: 1px solid #e5e7eb;
    }

    .dialog-title {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      line-height: 1.35;
    }

    .dialog-description {
      margin: 10px 0 0;
      color: #4b5563;
      font-size: 14px;
      line-height: 1.6;
    }

    .dialog-body {
      padding: 16px 24px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      overflow: hidden;
    }

    .summary {
      font-size: 14px;
      color: #334155;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .summary-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 28px;
      padding: 2px 8px;
      border-radius: 999px;
      background: #fee2e2;
      color: #b91c1c;
      font-weight: 700;
      font-size: 12px;
    }

    .conflict-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding-right: 4px;
      max-height: 240px;
      overflow-y: auto;
    }

    .conflict-row {
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      background: #f8fafc;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .conflict-row-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .conflict-type {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      background: #dbeafe;
      color: #1d4ed8;
      white-space: nowrap;
    }

    .name-pair {
      display: grid;
      grid-template-columns: 88px 1fr;
      gap: 6px 12px;
      align-items: start;
      font-size: 13px;
      color: #1f2937;
    }

    .name-label,
    .conflict-files-label {
      color: #64748b;
      font-weight: 600;
    }

    .name-value {
      word-break: break-all;
      line-height: 1.5;
    }

    .name-arrow {
      color: #94a3b8;
      font-weight: 600;
      margin: 0 6px;
    }

    .conflict-files {
      display: grid;
      grid-template-columns: 88px 1fr;
      gap: 8px 12px;
      align-items: start;
      font-size: 13px;
    }

    .conflict-files-list {
      margin: 0;
      padding-left: 18px;
      color: #475569;
      line-height: 1.5;
    }

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px 24px;
      border-top: 1px solid #e5e7eb;
      flex-wrap: wrap;
    }

    .button {
      border: 1px solid transparent;
      border-radius: 10px;
      padding: 10px 16px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
    }

    .button:hover {
      transform: translateY(-1px);
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
    }

    .button:active {
      transform: translateY(0);
      box-shadow: none;
    }

    .button-primary {
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      color: #fff;
    }

    .button-secondary {
      background: #fff;
      color: #1f2937;
      border-color: #cbd5e1;
    }

    .button-tertiary {
      background: #f8fafc;
      color: #475569;
      border-color: #e2e8f0;
    }

    @media (max-width: 640px) {
      .dialog-overlay {
        padding: 12px;
      }

      .dialog {
        width: 100%;
      }

      .name-pair,
      .conflict-files {
        grid-template-columns: 1fr;
      }

      .dialog-footer {
        flex-direction: column-reverse;
      }

      .button {
        width: 100%;
      }
    }
  `;

  render() {
    return html`
      <div
        class="dialog-overlay ${this.open ? 'open' : ''}"
        data-role="dialog-overlay"
        @click=${this.handleOverlayClick}
      >
        <div class="dialog" @click=${this.stopPropagation}>
          <div class="dialog-header">
            <h3 class="dialog-title">${I18nService.t('conflict_dialog_title', [String(this.conflictCount)])}</h3>
            <p class="dialog-description">${I18nService.t('conflict_dialog_description')}</p>
          </div>

          <div class="dialog-body">
            <div class="summary">
              <span class="summary-badge">${this.conflictCount}</span>
              <span>${I18nService.t('conflict_dialog_summary')}</span>
            </div>

            <div class="conflict-list" data-role="conflict-list">
              ${this.items.length > 0
                ? this.items.map((item) => this.renderConflictRow(item))
                : html`<div class="conflict-row" data-role="conflict-row" data-conflict-type="none">
                    <div class="name-value">${I18nService.t('conflict_dialog_empty')}</div>
                  </div>`}
            </div>
          </div>

          <div class="dialog-footer">
            <button
              class="button button-tertiary"
              type="button"
              data-role="cancel-button"
              @click=${this.handleClose}
            >
              ${I18nService.t('conflict_dialog_cancel')}
            </button>
            <button
              class="button button-secondary"
              type="button"
              data-role="skip-button"
              @click=${() => this.handleResolve(ConflictResolution.SKIP)}
            >
              ${I18nService.t('conflict_dialog_skip')}
            </button>
            <button
              class="button button-primary"
              type="button"
              data-role="auto-number-button"
              @click=${() => this.handleResolve(ConflictResolution.AUTO_NUMBER)}
            >
              ${I18nService.t('conflict_dialog_auto_number')}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private renderConflictRow(item: ConflictDetail) {
    return html`
      <div class="conflict-row" data-role="conflict-row" data-conflict-type=${item.type}>
        <div class="conflict-row-header">
          <strong>${item.originalName}</strong>
          <span class="conflict-type">${this.getConflictTypeLabel(item.type)}</span>
        </div>

        <div class="name-pair">
          <div class="name-label">${I18nService.t('conflict_dialog_original_name')}</div>
          <div class="name-value">${item.originalName}</div>

          <div class="name-label">${I18nService.t('conflict_dialog_target_name')}</div>
          <div class="name-value">
            <span>${item.targetName}</span>
            <span class="name-arrow">→</span>
            <span>${this.getConflictTypeHint(item.type)}</span>
          </div>
        </div>

        ${item.conflictingFiles.length > 0
          ? html`
              <div class="conflict-files">
                <div class="conflict-files-label">${I18nService.t('conflict_dialog_conflicting_files')}</div>
                <ul class="conflict-files-list">
                  ${item.conflictingFiles.map((name) => html`<li>${name}</li>`) }
                </ul>
              </div>
            `
          : nothing}
      </div>
    `;
  }

  private getConflictTypeLabel(type: ConflictType): string {
    switch (type) {
      case ConflictType.DUPLICATE_IN_BATCH:
        return I18nService.t('conflict_dialog_type_batch');
      case ConflictType.NAME_EXISTS:
        return I18nService.t('conflict_dialog_type_existing');
      default:
        return I18nService.t('preview_badge_conflict');
    }
  }

  private getConflictTypeHint(type: ConflictType): string {
    switch (type) {
      case ConflictType.DUPLICATE_IN_BATCH:
        return I18nService.t('conflict_dialog_type_batch_hint');
      case ConflictType.NAME_EXISTS:
        return I18nService.t('conflict_dialog_type_existing_hint');
      default:
        return I18nService.t('preview_badge_conflict');
    }
  }

  private handleResolve(resolution: ConflictResolution): void {
    this.dispatchEvent(
      new CustomEvent('conflict-dialog-resolve', {
        detail: { resolution },
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleClose(): void {
    this.dispatchEvent(
      new CustomEvent('dialog-close', {
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleOverlayClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.handleClose();
    }
  }

  private stopPropagation(event: Event): void {
    event.stopPropagation();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'conflict-resolution-dialog': ConflictResolutionDialog;
  }
}
