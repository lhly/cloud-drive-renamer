import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { RuleType, RuleConfig } from '../../types/rule';
import { ProgressEvent } from '../../types/core';
import { type DiagnosticPromptState } from '../../types/diagnostic';
import { I18nService } from '../../utils/i18n';

/**
 * Config Panel Component
 * Left panel for rule selection and configuration
 *
 * @fires config-change - Dispatched when rule configuration changes
 * @fires execute - Dispatched when execute button is clicked
 *
 * @example
 * ```html
 * <config-panel
 *   .selectedCount=${5}
 *   @config-change=${this.handleConfigChange}
 *   @execute=${this.handleExecute}>
 * </config-panel>
 * ```
 */
@customElement('config-panel')
export class ConfigPanel extends LitElement {
  /**
   * Number of selected files
   */
  @property({ type: Number })
  selectedCount = 0;

  /**
   * Number of files that will actually be renamed (preview items)
   */
  @property({ type: Number })
  renameCount = 0;

  /**
   * Number of conflicts detected
   */
  @property({ type: Number })
  conflictCount = 0;

  /**
   * Whether the execute button is disabled
   */
  @property({ type: Boolean })
  disabled = false;

  /**
   * Whether the panel is in loading/executing state
   */
  @property({ type: Boolean })
  executing = false;

  /**
   * Execution progress (only when executing/finished)
   */
  @property({ type: Object })
  progress: ProgressEvent | null = null;

  /**
   * Whether the last execution has finished (including cancelled)
   */
  @property({ type: Boolean })
  finished = false;

  /**
   * Whether executor is paused
   */
  @property({ type: Boolean })
  paused = false;

  /**
   * Page list sync status after rename
   */
  @property({ type: String })
  syncStatus: 'idle' | 'syncing' | 'success' | 'failed' = 'idle';

  /**
   * Optional sync message
   */
  @property({ type: String })
  syncMessage: string | null = null;

  /**
   * Whether sync is supported by the current adapter (optional)
   */
  @property({ type: Boolean })
  syncSupported = false;

  @property({ type: Boolean })
  canUndo = false;

  @property({ type: Boolean })
  undoBusy = false;

  @property({ attribute: false })
  diagnosticPromptState: DiagnosticPromptState = 'hidden';

  @property({ type: Number })
  diagnosticFailureCount = 0;

  @property({ attribute: false })
  diagnosticFileName: string | null = null;

  @property({ attribute: false })
  diagnosticErrorMessage: string | null = null;

  /**
   * Current selected rule type
   */
  @state()
  private selectedRuleType: RuleType = 'replace';

  /**
   * Rule parameters configuration
   */
  @state()
  private ruleParams: Record<string, any> = {
    search: '',
    replace: '',
    caseSensitive: false,
    global: true,
  };

  @state()
  private regexValidationError: string | null = null;

  /**
   * Handle rule type change
   * @private
   */
  private handleRuleChange(type: RuleType): void {
    this.selectedRuleType = type;
    this.regexValidationError = null;

    // Reset params based on rule type
    switch (type) {
      case 'replace':
        this.ruleParams = { search: '', replace: '', caseSensitive: false, global: true };
        break;
      case 'regex':
        this.ruleParams = {
          pattern: '',
          replace: '',
          caseSensitive: false,
          global: true,
          flags: '',
          includeExtension: false,
        };
        break;
      case 'prefix':
        this.ruleParams = { prefix: '', separator: '' };
        break;
      case 'suffix':
        this.ruleParams = { suffix: '', separator: '' };
        break;
      case 'numbering':
        this.ruleParams = {
          startNumber: 1,
          digits: 3,
          position: 'prefix',
          format: '{num}',
          separator: '-',
        };
        break;
      case 'sanitize':
        this.ruleParams = { removeIllegal: true, removeChars: '' };
        break;
      case 'episodeExtract':
        this.ruleParams = {
          template: '{prefix}.S{season}E{episode}{ext}',
          prefix: '',
          season: 1,
          offset: 0,
          leadingZeroCount: 3,
          helperPre: '',
          helperPost: '',
        };
        break;
    }

    this.validateRegexIfNeeded();
    this.emitConfigChange();
  }

  /**
   * Update rule parameter
   * @private
   */
  private updateParam(key: string, value: any): void {
    this.ruleParams = {
      ...this.ruleParams,
      [key]: value,
    };

    this.validateRegexIfNeeded();
    this.emitConfigChange();
  }

  private validateRegexIfNeeded(): void {
    if (this.selectedRuleType !== 'regex') {
      this.regexValidationError = null;
      return;
    }

    const pattern = String(this.ruleParams.pattern || '');
    if (!pattern) {
      this.regexValidationError = null;
      return;
    }

    const flags = this.getRegexFlags(this.ruleParams);

    try {
      // eslint-disable-next-line no-new
      new RegExp(pattern, flags);
      this.regexValidationError = null;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.regexValidationError = errorObj.message;
    }
  }

  private getRegexFlags(params: Record<string, any>): string {
    const global = Boolean(params.global);
    const caseSensitive = Boolean(params.caseSensitive);
    const base = (global ? 'g' : '') + (caseSensitive ? '' : 'i');

    // 自定义 flags（高级，可选）：仅允许追加其它 flags，g/i 由开关控制
    const raw = String(params.flags || '');
    const cleaned = raw.replace(/[^a-z]/gi, '').toLowerCase();
    const extraSet = new Set<string>();
    for (const ch of cleaned) {
      if (ch === 'g' || ch === 'i') continue;
      extraSet.add(ch);
    }

    // 与规则实现保持一致的稳定顺序
    const preferredOrder = ['m', 's', 'u', 'y', 'd', 'v'];
    const extras: string[] = [];
    for (const ch of preferredOrder) {
      if (extraSet.has(ch)) {
        extras.push(ch);
        extraSet.delete(ch);
      }
    }
    for (const ch of extraSet) {
      extras.push(ch);
    }

    return base + extras.join('');
  }

  /**
   * Emit config change event
   * @private
   */
  private emitConfigChange(): void {
    const config: RuleConfig = {
      type: this.selectedRuleType,
      params: this.ruleParams,
    };

    this.dispatchEvent(
      new CustomEvent('config-change', {
        detail: config,
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * Handle execute button click
   * @private
   */
  private handleExecute(): void {
    if (this.renameCount === 0 || this.disabled || this.executing) {
      return;
    }

    this.dispatchEvent(
      new CustomEvent('execute', {
        bubbles: true,
        composed: true,
      })
    );
  }

  private renderUndoIconButton() {
    const label = this.undoBusy ? I18nService.t('undo_in_progress') : I18nService.t('undo_last_rename');

    return html`
      <button
        class="button-icon button-icon-undo ${this.undoBusy ? 'is-busy' : ''}"
        data-role="undo-icon-button"
        ?disabled=${!this.canUndo || this.undoBusy}
        @click=${this.handleUndo}
        title=${label}
        aria-label=${label}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 7v6h6"></path>
          <path d="M21 17a8 8 0 0 0-13.66-5.66L3 17"></path>
        </svg>
      </button>
    `;
  }

  render() {
    const canExecute = this.renameCount > 0 && !this.disabled && !this.executing;
    const hasConflicts = this.conflictCount > 0;
    const showExecutionView = this.executing || this.finished;

    return html`
      <div class="config-panel">
        <div class="panel-header">
          <h3 class="panel-title">${I18nService.t('config_panel_title')}</h3>
        </div>

        <div class="panel-body">
          ${showExecutionView ? this.renderExecutionView() : html`${this.renderRuleSelector()}${this.renderRuleConfig()}`}
        </div>

        <div class="panel-footer">
          ${!showExecutionView && hasConflicts
            ? html`
                <div class="warning-message">
                  ⚠️ ${I18nService.t('conflicts_detected', [String(this.conflictCount)])}
                </div>
              `
            : ''}

          ${showExecutionView
            ? this.renderExecutionActions()
            : html`
                <div class="execution-actions">
                  <div class="execution-actions-main">
                    <button
                      class="button button-primary button-execute"
                      ?disabled=${!canExecute}
                      @click=${this.handleExecute}
                    >
                      ${this.executing ? I18nService.t('executing') : I18nService.t('execute_rename')}
                      ${this.selectedCount > 0 ? ` (${this.renameCount})` : ''}
                    </button>
                  </div>
                  ${this.renderUndoIconButton()}
                </div>
              `}
        </div>
      </div>
    `;
  }

  private renderExecutionView() {
    const progress = this.progress;
    const total = progress?.total ?? 0;
    const completed = progress?.completed ?? 0;
    const success = progress?.success ?? 0;
    const failed = progress?.failed ?? 0;
    const remaining = Math.max(0, total - completed);
    const percentage = total > 0 ? (completed / total) * 100 : 0;

    const syncText =
      this.syncStatus === 'syncing'
        ? I18nService.t('syncing_list')
        : this.syncStatus === 'success'
          ? I18nService.t('sync_success')
          : this.syncStatus === 'failed'
            ? I18nService.t('sync_failed')
            : '';
    const showSyncStatus = Boolean(syncText) || Boolean(this.syncMessage);

    return html`
      <div class="execution-view">
        <div class="execution-title">
          ${this.executing ? I18nService.t('progress_dialog_title') : I18nService.t('execution_finished_title')}
        </div>

        <div class="progress-bar-container" role="progressbar" aria-valuenow=${percentage.toFixed(1)} aria-valuemin="0" aria-valuemax="100">
          <div class="progress-bar" style="width: ${percentage}%"></div>
        </div>

        <div class="progress-text">
          <span class="percentage">${percentage.toFixed(1)}%</span>
          <span>${completed} / ${total}</span>
        </div>

        <div class="current-file" title=${progress?.currentFile || ''}>
          <strong>${I18nService.t('progress_current_file')}</strong>${progress?.currentFile || '-'}
        </div>

        <div class="stats">
          <div class="stat-item">
            <div class="stat-label">${I18nService.t('progress_success')}</div>
            <div class="stat-value success">${success}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">${I18nService.t('progress_failed')}</div>
            <div class="stat-value failed">${failed}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">${I18nService.t('progress_remaining')}</div>
            <div class="stat-value">${remaining}</div>
          </div>
        </div>

        ${this.finished && showSyncStatus
          ? html`
              <div class="sync-status ${this.syncStatus}">
                ${syncText}${this.syncMessage ? `：${this.syncMessage}` : ''}
                ${this.syncSupported && this.syncStatus === 'failed'
                  ? html`
                      <button class="sync-retry" @click=${this.handleSync}>
                        ${I18nService.t('sync_retry')}
                      </button>
                    `
                  : ''}
              </div>
            `
          : ''}

        ${this.renderDiagnosticPrompt()}
      </div>
    `;
  }

  private renderExecutionActions() {
    if (this.executing) {
      return html`
        <div class="execution-actions">
          <button class="button button-default" @click=${this.handlePauseToggle}>
            ${this.paused ? I18nService.t('progress_button_resume') : I18nService.t('progress_button_pause')}
          </button>
          <button class="button button-danger" @click=${this.handleCancel}>
            ${I18nService.t('progress_button_cancel')}
          </button>
        </div>
      `;
    }

    const failed = this.progress?.failed ?? 0;

    return html`
      <div class="execution-actions">
        <div class="execution-actions-main">
          <button class="button button-primary" ?disabled=${failed <= 0} @click=${this.handleRetry}>
            ${I18nService.t('retry')}
          </button>
          <button class="button button-default" @click=${this.handleBack}>
            ${I18nService.t('back')}
          </button>
        </div>
        ${this.renderUndoIconButton()}
      </div>
    `;
  }

  private handlePauseToggle(): void {
    this.dispatchEvent(
      new CustomEvent('pause', {
        detail: { isPaused: !this.paused },
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleCancel(): void {
    this.dispatchEvent(
      new CustomEvent('cancel', {
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleSync(): void {
    this.dispatchEvent(
      new CustomEvent('sync', {
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleRetry(): void {
    this.dispatchEvent(
      new CustomEvent('retry', {
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleUndo(): void {
    this.dispatchEvent(
      new CustomEvent('undo', {
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleBack(): void {
    this.dispatchEvent(
      new CustomEvent('back', {
        bubbles: true,
        composed: true,
      })
    );
  }

  private renderDiagnosticPrompt() {
    if (!this.finished || this.diagnosticPromptState === 'hidden') {
      return null;
    }

    const isExporting = this.diagnosticPromptState === 'exporting';
    const isExported = this.diagnosticPromptState === 'exported';
    const isError = this.diagnosticPromptState === 'error';

    let message = I18nService.t('diagnostic_prompt_ready');
    if (isExporting) {
      message = I18nService.t('diagnostic_exporting');
    } else if (isExported) {
      message = I18nService.t('diagnostic_exported_message');
    } else if (isError) {
      message = I18nService.t('diagnostic_export_failed');
    }

    const promptClass = [
      'diagnostic-prompt',
      isExported ? 'exported' : '',
      isError ? 'error' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return html`
      <div class=${promptClass}>
        <div class="diagnostic-prompt-message">
          <span>${message}</span>
          ${isExported && this.diagnosticFileName
            ? html`<span class="diagnostic-file-name">${this.diagnosticFileName}</span>`
            : ''}
          ${isError && this.diagnosticErrorMessage
            ? html`<span class="diagnostic-file-name">${this.diagnosticErrorMessage}</span>`
            : ''}
          ${!isExported && !isError && this.diagnosticFailureCount > 0
            ? html`
                <span class="diagnostic-file-name">
                  ${this.diagnosticFailureCount} ${I18nService.t('progress_failed')}
                </span>
              `
            : ''}
        </div>

        <div class="diagnostic-prompt-actions">
          ${isExported
            ? html`
                <button
                  class="button button-default"
                  data-role="diagnostic-feedback-github"
                  @click=${this.handleDiagnosticFeedbackGithub}
                >
                  ${I18nService.t('diagnostic_feedback_github')}
                </button>
                <button
                  class="button button-default"
                  data-role="diagnostic-feedback-email"
                  @click=${this.handleDiagnosticFeedbackEmail}
                >
                  ${I18nService.t('diagnostic_feedback_email')}
                </button>
                <button
                  class="button button-default"
                  data-role="diagnostic-copy-button"
                  @click=${this.handleDiagnosticCopy}
                >
                  ${I18nService.t('diagnostic_copy')}
                </button>
              `
            : html`
                <button
                  class="button button-default"
                  data-role="diagnostic-export-button"
                  ?disabled=${isExporting}
                  @click=${this.handleDiagnosticExport}
                >
                  ${isExporting
                    ? I18nService.t('diagnostic_exporting')
                    : isError
                      ? I18nService.t('diagnostic_export_retry')
                      : I18nService.t('diagnostic_export')}
                </button>
              `}

          <button
            class="button button-default"
            data-role="diagnostic-dismiss-button"
            @click=${this.handleDiagnosticDismiss}
          >
            ${I18nService.t('diagnostic_dismiss')}
          </button>
        </div>
      </div>
    `;
  }

  private emitDiagnosticEvent(name: string): void {
    this.dispatchEvent(
      new CustomEvent(name, {
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleDiagnosticExport(): void {
    this.emitDiagnosticEvent('diagnostic-export');
  }

  private handleDiagnosticDismiss(): void {
    this.emitDiagnosticEvent('diagnostic-dismiss');
  }

  private handleDiagnosticFeedbackGithub(): void {
    this.emitDiagnosticEvent('diagnostic-feedback-github');
  }

  private handleDiagnosticFeedbackEmail(): void {
    this.emitDiagnosticEvent('diagnostic-feedback-email');
  }

  private handleDiagnosticCopy(): void {
    this.emitDiagnosticEvent('diagnostic-copy');
  }

  /**
   * Render rule selector
   * @private
   */
  private renderRuleSelector() {
    const rules: { type: RuleType; label: string }[] = [
      { type: 'replace', label: I18nService.t('rule_replace') },
      { type: 'regex', label: I18nService.t('rule_regex') },
      { type: 'prefix', label: I18nService.t('rule_prefix') },
      { type: 'suffix', label: I18nService.t('rule_suffix') },
      { type: 'numbering', label: I18nService.t('rule_numbering') },
      { type: 'sanitize', label: I18nService.t('rule_sanitize') },
      { type: 'episodeExtract', label: I18nService.t('rule_episode_extract') },
    ];

    return html`
      <div class="rule-selector">
        <div class="section-title">${I18nService.t('rule_selector_title')}</div>
        <div class="rule-options">
          ${rules.map(
            rule => html`
              <label class="rule-option ${this.selectedRuleType === rule.type ? 'selected' : ''}">
                <input
                  type="radio"
                  name="rule"
                  value=${rule.type}
                  ?checked=${this.selectedRuleType === rule.type}
                  @change=${() => this.handleRuleChange(rule.type)}
                />
                <div>${rule.label}</div>
              </label>
            `
          )}
        </div>
      </div>
    `;
  }

  /**
   * Render rule configuration form
   * @private
   */
  private renderRuleConfig() {
    return html`
      <div class="rule-config">
        <div class="section-title">${I18nService.t('rule_config_title')}</div>
        ${this.renderRuleParams()}
      </div>
    `;
  }

  /**
   * Render rule-specific parameters
   * @private
   */
  private renderRuleParams() {
    switch (this.selectedRuleType) {
      case 'replace':
        return html`
          <div class="form-group">
            <label class="form-label">${I18nService.t('param_search_text')}</label>
            <input
              type="text"
              class="form-input"
              .value=${this.ruleParams.search || ''}
              @input=${(e: Event) => this.updateParam('search', (e.target as HTMLInputElement).value)}
              placeholder="${I18nService.t('param_search_placeholder')}"
            />
          </div>

          <div class="form-group">
            <label class="form-label">${I18nService.t('param_replace_with')}</label>
            <input
              type="text"
              class="form-input"
              .value=${this.ruleParams.replace || ''}
              @input=${(e: Event) => this.updateParam('replace', (e.target as HTMLInputElement).value)}
              placeholder="${I18nService.t('param_replace_placeholder')}"
            />
          </div>

          <div class="form-group">
            <label class="form-checkbox">
              <input
                type="checkbox"
                ?checked=${this.ruleParams.caseSensitive || false}
                @change=${(e: Event) => this.updateParam('caseSensitive', (e.target as HTMLInputElement).checked)}
              />
              <span>${I18nService.t('param_case_sensitive')}</span>
            </label>
          </div>

          <div class="form-group">
            <label class="form-checkbox">
              <input
                type="checkbox"
                ?checked=${this.ruleParams.global ?? true}
                @change=${(e: Event) => this.updateParam('global', (e.target as HTMLInputElement).checked)}
              />
              <span>${I18nService.t('param_replace_all')}</span>
            </label>
          </div>
        `;

      case 'regex': {
        const flags = this.getRegexFlags(this.ruleParams);
        return html`
          <div class="form-group">
            <label class="form-label">${I18nService.t('param_regex_pattern')}</label>
            <input
              type="text"
              class="form-input"
              .value=${this.ruleParams.pattern || ''}
              @input=${(e: Event) => this.updateParam('pattern', (e.target as HTMLInputElement).value)}
              placeholder="${I18nService.t('param_regex_pattern_placeholder')}"
            />
            ${this.regexValidationError
              ? html`<div class="hint-text hint-text-error">
                  ${I18nService.t('param_regex_invalid')}: ${this.regexValidationError}
                </div>`
              : html`<div class="hint-text">${I18nService.t('param_regex_flags_hint', [flags || '(none)'])}</div>`}
          </div>

          <div class="form-group">
            <label class="form-label">${I18nService.t('param_replace_with')}</label>
            <input
              type="text"
              class="form-input"
              .value=${this.ruleParams.replace || ''}
              @input=${(e: Event) => this.updateParam('replace', (e.target as HTMLInputElement).value)}
              placeholder="${I18nService.t('param_replace_placeholder')}"
            />
          </div>

          <div class="form-group">
            <label class="form-checkbox">
              <input
                type="checkbox"
                ?checked=${this.ruleParams.caseSensitive || false}
                @change=${(e: Event) => this.updateParam('caseSensitive', (e.target as HTMLInputElement).checked)}
              />
              <span>${I18nService.t('param_case_sensitive')}</span>
            </label>
          </div>

          <div class="form-group">
            <label class="form-checkbox">
              <input
                type="checkbox"
                ?checked=${this.ruleParams.global ?? true}
                @change=${(e: Event) => this.updateParam('global', (e.target as HTMLInputElement).checked)}
              />
              <span>${I18nService.t('param_replace_all')}</span>
            </label>
          </div>

          <div class="form-group">
            <label class="form-label">${I18nService.t('param_regex_flags')}</label>
            <input
              type="text"
              class="form-input"
              .value=${this.ruleParams.flags || ''}
              @input=${(e: Event) => this.updateParam('flags', (e.target as HTMLInputElement).value)}
              placeholder="${I18nService.t('param_regex_flags_placeholder')}"
            />
            <div class="hint-text">${I18nService.t('param_regex_flags_extra_hint')}</div>
          </div>

          <div class="form-group">
            <label class="form-checkbox">
              <input
                type="checkbox"
                ?checked=${this.ruleParams.includeExtension || false}
                @change=${(e: Event) => this.updateParam('includeExtension', (e.target as HTMLInputElement).checked)}
              />
              <span>${I18nService.t('param_regex_include_extension')}</span>
            </label>
          </div>
        `;
      }

      case 'prefix':
        return html`
          <div class="form-group">
            <label class="form-label">${I18nService.t('param_prefix_text')}</label>
            <input
              type="text"
              class="form-input"
              .value=${this.ruleParams.prefix || ''}
              @input=${(e: Event) => this.updateParam('prefix', (e.target as HTMLInputElement).value)}
              placeholder="${I18nService.t('param_prefix_placeholder')}"
            />
          </div>

          <div class="form-group">
            <label class="form-label">${I18nService.t('param_separator')}</label>
            <input
              type="text"
              class="form-input"
              .value=${this.ruleParams.separator || ''}
              @input=${(e: Event) => this.updateParam('separator', (e.target as HTMLInputElement).value)}
              placeholder="${I18nService.t('param_separator_placeholder')}"
            />
            <div class="hint-text">${I18nService.t('param_separator_hint_prefix')}</div>
          </div>
        `;

      case 'suffix':
        return html`
          <div class="form-group">
            <label class="form-label">${I18nService.t('param_suffix_text')}</label>
            <input
              type="text"
              class="form-input"
              .value=${this.ruleParams.suffix || ''}
              @input=${(e: Event) => this.updateParam('suffix', (e.target as HTMLInputElement).value)}
              placeholder="${I18nService.t('param_suffix_placeholder')}"
            />
          </div>

          <div class="form-group">
            <label class="form-label">${I18nService.t('param_separator')}</label>
            <input
              type="text"
              class="form-input"
              .value=${this.ruleParams.separator || ''}
              @input=${(e: Event) => this.updateParam('separator', (e.target as HTMLInputElement).value)}
              placeholder="${I18nService.t('param_separator_placeholder')}"
            />
            <div class="hint-text">${I18nService.t('param_separator_hint_suffix')}</div>
          </div>
        `;

      case 'numbering':
        return html`
          <div class="form-group">
            <label class="form-label">${I18nService.t('param_start_number')}</label>
            <input
              type="number"
              class="form-input"
              .value=${String(this.ruleParams.startNumber ?? 1)}
              @input=${(e: Event) =>
                this.updateParam('startNumber', parseInt((e.target as HTMLInputElement).value, 10))}
              min="0"
            />
          </div>

          <div class="form-group">
            <label class="form-label">${I18nService.t('param_digits')}</label>
            <input
              type="number"
              class="form-input"
              .value=${String(this.ruleParams.digits ?? 3)}
              @input=${(e: Event) => this.updateParam('digits', parseInt((e.target as HTMLInputElement).value, 10))}
              min="1"
              max="10"
            />
            <div class="hint-text">${I18nService.t('param_digits_hint')}</div>
          </div>

          <div class="form-group">
            <label class="form-label">${I18nService.t('param_position')}</label>
            <select
              class="form-select"
              .value=${this.ruleParams.position || 'prefix'}
              @change=${(e: Event) => this.updateParam('position', (e.target as HTMLSelectElement).value)}
            >
              <option value="prefix">${I18nService.t('param_position_prefix')}</option>
              <option value="suffix">${I18nService.t('param_position_suffix')}</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">${I18nService.t('param_format_template')}</label>
            <input
              type="text"
              class="form-input"
              .value=${this.ruleParams.format || '{num}'}
              @input=${(e: Event) => this.updateParam('format', (e.target as HTMLInputElement).value)}
              placeholder="{num}"
            />
            <div class="hint-text">${I18nService.t('param_format_hint')}</div>
          </div>

          <div class="form-group">
            <label class="form-label">${I18nService.t('param_separator')}</label>
            <input
              type="text"
              class="form-input"
              .value=${this.ruleParams.separator || '-'}
              @input=${(e: Event) => this.updateParam('separator', (e.target as HTMLInputElement).value)}
              placeholder="-"
            />
          </div>
        `;

      case 'sanitize':
        return html`
          <div class="form-group">
            <label class="form-checkbox">
              <input
                type="checkbox"
                ?checked=${this.ruleParams.removeIllegal ?? true}
                @change=${(e: Event) => this.updateParam('removeIllegal', (e.target as HTMLInputElement).checked)}
              />
              <span>${I18nService.t('param_remove_illegal')}</span>
            </label>
            <div class="hint-text">${I18nService.t('param_remove_illegal_hint')}</div>
          </div>

          <div class="form-group">
            <label class="form-label">${I18nService.t('param_remove_chars')}</label>
            <input
              type="text"
              class="form-input"
              .value=${this.ruleParams.removeChars || ''}
              @input=${(e: Event) => this.updateParam('removeChars', (e.target as HTMLInputElement).value)}
              placeholder="${I18nService.t('param_remove_chars_placeholder')}"
            />
            <div class="hint-text">${I18nService.t('param_remove_chars_hint')}</div>
          </div>
        `;

      case 'episodeExtract':
        return html`
          <div class="form-group">
            <label class="form-label">${I18nService.t('param_extract_template')}</label>
            <input
              type="text"
              class="form-input"
              .value=${this.ruleParams.template || '{prefix}.S{season}E{episode}{ext}'}
              @input=${(e: Event) => this.updateParam('template', (e.target as HTMLInputElement).value)}
              placeholder="${I18nService.t('param_extract_template_placeholder')}"
            />
            <div class="hint-text">${I18nService.t('param_extract_template_hint')}</div>
          </div>

          <div class="form-group">
            <label class="form-label">${I18nService.t('param_extract_prefix')}</label>
            <input
              type="text"
              class="form-input"
              .value=${this.ruleParams.prefix || ''}
              @input=${(e: Event) => this.updateParam('prefix', (e.target as HTMLInputElement).value)}
              placeholder="${I18nService.t('param_extract_prefix_placeholder')}"
            />
          </div>

          <div class="form-group">
            <label class="form-label">${I18nService.t('param_extract_season')}</label>
            <input
              type="number"
              class="form-input"
              .value=${String(this.ruleParams.season ?? 1)}
              @input=${(e: Event) => this.updateParam('season', (e.target as HTMLInputElement).value)}
              min="1"
              max="99"
            />
            <div class="hint-text">${I18nService.t('param_extract_season_hint')}</div>
          </div>

          <div class="form-group">
            <label class="form-label">${I18nService.t('param_extract_offset')}</label>
            <input
              type="number"
              class="form-input"
              .value=${String(this.ruleParams.offset ?? 0)}
              @input=${(e: Event) => this.updateParam('offset', (e.target as HTMLInputElement).value)}
            />
            <div class="hint-text">${I18nService.t('param_extract_offset_hint')}</div>
          </div>

          <div class="form-group">
            <label class="form-label">${I18nService.t('param_extract_leading_zero_count')}</label>
            <input
              type="number"
              class="form-input"
              .value=${String(this.ruleParams.leadingZeroCount ?? 3)}
              @input=${(e: Event) =>
                this.updateParam('leadingZeroCount', parseInt((e.target as HTMLInputElement).value, 10))}
              min="1"
              max="10"
            />
          </div>

          <div class="form-group">
            <label class="form-label">${I18nService.t('param_extract_helper_pre')}</label>
            <input
              type="text"
              class="form-input"
              .value=${this.ruleParams.helperPre || ''}
              @input=${(e: Event) => this.updateParam('helperPre', (e.target as HTMLInputElement).value)}
              placeholder="${I18nService.t('param_extract_helper_pre_placeholder')}"
            />
          </div>

          <div class="form-group">
            <label class="form-label">${I18nService.t('param_extract_helper_post')}</label>
            <input
              type="text"
              class="form-input"
              .value=${this.ruleParams.helperPost || ''}
              @input=${(e: Event) => this.updateParam('helperPost', (e.target as HTMLInputElement).value)}
              placeholder="${I18nService.t('param_extract_helper_post_placeholder')}"
            />
          </div>
        `;

      default:
        return html``;
    }
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--cdr-surface, #fff);
      border-right: 1px solid var(--cdr-border, #f0f0f0);
      color: var(--cdr-text, #262626);
    }

    .config-panel {
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
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--cdr-text, #262626);
    }

    .panel-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }

    .panel-footer {
      padding: 16px;
      border-top: 1px solid var(--cdr-border, #f0f0f0);
      flex-shrink: 0;
    }

    .execution-view {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .execution-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--cdr-text, #262626);
    }

    .progress-bar-container {
      width: 100%;
      height: 8px;
      background: var(--cdr-border, #f0f0f0);
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-bar {
      height: 100%;
      background: linear-gradient(90deg, #1890ff, #52c41a);
      transition: width 0.25s ease;
    }

    .progress-text {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      color: var(--cdr-text-secondary, #595959);
    }

    .percentage {
      font-weight: 600;
      color: var(--cdr-text, #262626);
    }

    .current-file {
      background: var(--cdr-surface-muted, #fafafa);
      border: 1px solid var(--cdr-border, #f0f0f0);
      padding: 10px 12px;
      border-radius: 6px;
      font-size: 12px;
      color: var(--cdr-text-secondary, #595959);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .current-file strong {
      color: var(--cdr-text, #262626);
      margin-right: 8px;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      padding: 10px 12px;
      background: var(--cdr-surface-muted, #fafafa);
      border: 1px solid var(--cdr-border, #f0f0f0);
      border-radius: 6px;
    }

    .stat-item {
      text-align: center;
    }

    .stat-label {
      font-size: 12px;
      color: var(--cdr-text-tertiary, #8c8c8c);
      margin-bottom: 4px;
    }

    .stat-value {
      font-size: 18px;
      font-weight: 600;
      color: var(--cdr-text, #262626);
    }

    .stat-value.success {
      color: #52c41a;
    }

    .stat-value.failed {
      color: #ff4d4f;
    }

    .sync-status {
      font-size: 12px;
      color: var(--cdr-text-secondary, #595959);
      padding: 8px 10px;
      border-radius: 6px;
      border: 1px solid transparent;
      background: var(--cdr-surface-muted, #fafafa);
    }

    .sync-status.success {
      color: var(--cdr-success-text, #389e0d);
      background: var(--cdr-success-bg, #f6ffed);
      border-color: var(--cdr-success-border, #b7eb8f);
    }

    .sync-status.failed {
      color: var(--cdr-danger-text, #cf1322);
      background: var(--cdr-danger-bg, #fff1f0);
      border-color: var(--cdr-danger-border, #ffa39e);
    }

    .sync-status.syncing {
      color: var(--cdr-info-text, #0958d9);
      background: var(--cdr-info-bg, #e6f4ff);
      border-color: var(--cdr-info-border, #91caff);
    }

    .sync-retry {
      margin-left: 8px;
      padding: 0;
      border: none;
      background: transparent;
      color: var(--cdr-primary, #1890ff);
      cursor: pointer;
      font-size: 12px;
    }

    .sync-retry:hover {
      text-decoration: underline;
    }

    .diagnostic-prompt {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 12px;
      border-radius: 8px;
      border: 1px solid var(--cdr-warning-border, #ffd591);
      background: var(--cdr-warning-bg, #fffbe6);
    }

    .diagnostic-prompt.exported {
      border-color: var(--cdr-success-border, #b7eb8f);
      background: var(--cdr-success-bg, #f6ffed);
    }

    .diagnostic-prompt.error {
      border-color: var(--cdr-danger-border, #ffa39e);
      background: var(--cdr-danger-bg, #fff1f0);
    }

    .diagnostic-prompt-message {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 13px;
      color: var(--cdr-text-secondary, #595959);
    }

    .diagnostic-file-name {
      font-size: 12px;
      color: var(--cdr-text, #262626);
      word-break: break-all;
    }

    .diagnostic-prompt-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .execution-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      justify-content: flex-end;
    }

    .execution-actions-main {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      flex: 0 1 auto;
      min-width: 0;
      max-width: 100%;
    }

    .rule-selector {
      margin-bottom: 24px;
    }

    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--cdr-text, #262626);
      margin-bottom: 12px;
    }

    .rule-options {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .rule-option {
      padding: 12px;
      border: 2px solid var(--cdr-border-strong, #d9d9d9);
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .rule-option:hover {
      border-color: var(--cdr-primary, #1890ff);
    }

    .rule-option.selected {
      border-color: var(--cdr-primary, #1890ff);
      background-color: var(--cdr-selection-bg, #e6f7ff);
      color: var(--cdr-primary, #1890ff);
    }

    .rule-option input[type='radio'] {
      margin: 0;
    }

    .rule-config {
      margin-bottom: 16px;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-label {
      display: block;
      font-size: 14px;
      color: var(--cdr-text-secondary, #595959);
      margin-bottom: 8px;
    }

    .form-input {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid var(--cdr-border-strong, #d9d9d9);
      border-radius: 4px;
      font-size: 14px;
      transition: border-color 0.2s;
      box-sizing: border-box;
      background: var(--cdr-surface, #fff);
      color: var(--cdr-text, #262626);
    }

    .form-select {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid var(--cdr-border-strong, #d9d9d9);
      border-radius: 4px;
      font-size: 14px;
      transition: border-color 0.2s;
      box-sizing: border-box;
      background: var(--cdr-surface, #fff);
      color: var(--cdr-text, #262626);
    }

    .form-input:focus,
    .form-select:focus {
      outline: none;
      border-color: #1890ff;
      box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
    }

    .form-checkbox {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }

    .form-checkbox input {
      width: 16px;
      height: 16px;
      cursor: pointer;
    }

    .hint-text {
      font-size: 12px;
      color: var(--cdr-text-tertiary, #8c8c8c);
      margin-top: 4px;
      line-height: 1.5;
    }

    .hint-text-error {
      color: var(--cdr-danger, #ff4d4f);
    }

    .warning-message {
      padding: 8px 12px;
      background: var(--cdr-warning-bg, #fff7e6);
      border: 1px solid var(--cdr-warning-border, #ffd591);
      border-radius: 4px;
      color: var(--cdr-warning-text, #fa8c16);
      font-size: 13px;
      margin-bottom: 12px;
    }

    .button {
      width: 100%;
      padding: 10px 16px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .button-icon {
      width: 34px;
      height: 34px;
      padding: 0;
      border: 1px solid var(--cdr-border, #f0f0f0);
      border-radius: 10px;
      background: var(--cdr-surface-muted, #fafafa);
      color: var(--cdr-text-secondary, #595959);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      cursor: pointer;
      transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease, opacity 0.2s ease;
    }

    .button-icon svg {
      width: 16px;
      height: 16px;
      display: block;
    }

    .button-icon:hover:not(:disabled) {
      background: var(--cdr-surface-hover, #f5f5f5);
      border-color: var(--cdr-border-strong, #d9d9d9);
      color: var(--cdr-primary, #1890ff);
    }

    .button-icon:active:not(:disabled) {
      background: var(--cdr-selection-bg, #e6f7ff);
      border-color: var(--cdr-primary, #1890ff);
      color: var(--cdr-primary, #1890ff);
    }

    .button-icon.is-busy svg {
      animation: cdr-undo-spin 0.9s linear infinite;
    }

    .button-primary {
      background: var(--cdr-primary, #1890ff);
      color: #fff;
    }

    .button-primary:hover:not(:disabled) {
      background: var(--cdr-primary-hover, #40a9ff);
    }

    .button-primary:active:not(:disabled) {
      background: #096dd9;
    }

    .button-default {
      background: var(--cdr-surface, #fff);
      color: var(--cdr-text-secondary, #595959);
      border: 1px solid var(--cdr-border-strong, #d9d9d9);
    }

    .button-default:hover:not(:disabled) {
      border-color: var(--cdr-primary, #1890ff);
      color: var(--cdr-primary, #1890ff);
    }

    .button-danger {
      background: var(--cdr-danger, #ff4d4f);
      color: #fff;
    }

    .button-danger:hover:not(:disabled) {
      background: var(--cdr-danger-hover, #ff7875);
    }

    .button-danger:active:not(:disabled) {
      background: #cf1322;
    }

    .button:disabled {
      background: var(--cdr-surface-hover, #f5f5f5);
      color: var(--cdr-text-disabled, #bfbfbf);
      cursor: not-allowed;
    }

    .button-execute {
      min-width: 136px;
      font-size: 14px;
      padding: 10px 14px;
    }

    .execution-actions .button {
      width: auto;
      flex: 0 0 auto;
      min-width: 96px;
    }

    .button-icon:disabled {
      background: var(--cdr-surface-muted, #fafafa);
      border-color: var(--cdr-border, #f0f0f0);
      color: var(--cdr-text-disabled, #bfbfbf);
      cursor: not-allowed;
      opacity: 0.72;
    }

    @keyframes cdr-undo-spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'config-panel': ConfigPanel;
  }
}
