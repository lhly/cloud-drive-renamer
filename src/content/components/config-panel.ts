import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { RuleType, RuleConfig } from '../../types/rule';
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

  /**
   * Handle rule type change
   * @private
   */
  private handleRuleChange(type: RuleType): void {
    this.selectedRuleType = type;

    // Reset params based on rule type
    switch (type) {
      case 'replace':
        this.ruleParams = { search: '', replace: '', caseSensitive: false, global: true };
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
    }

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

    this.emitConfigChange();
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
    if (this.selectedCount === 0 || this.disabled || this.executing) {
      return;
    }

    this.dispatchEvent(
      new CustomEvent('execute', {
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    const canExecute = this.selectedCount > 0 && !this.disabled && !this.executing;
    const hasConflicts = this.conflictCount > 0;

    return html`
      <div class="config-panel">
        <div class="panel-header">
          <h3 class="panel-title">${I18nService.t('config_panel_title')}</h3>
        </div>

        <div class="panel-body">
          ${this.renderRuleSelector()}
          ${this.renderRuleConfig()}
        </div>

        <div class="panel-footer">
          ${hasConflicts
            ? html`
                <div class="warning-message">
                  ⚠️ 检测到 ${this.conflictCount} 个冲突
                </div>
              `
            : ''}

          <button
            class="button button-primary button-execute"
            ?disabled=${!canExecute}
            @click=${this.handleExecute}
          >
            ${this.executing ? I18nService.t('executing') : I18nService.t('execute_rename')}
            ${this.selectedCount > 0 ? ` (${this.selectedCount})` : ''}
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render rule selector
   * @private
   */
  private renderRuleSelector() {
    const rules: { type: RuleType; label: string }[] = [
      { type: 'replace', label: I18nService.t('rule_replace') },
      { type: 'prefix', label: I18nService.t('rule_prefix') },
      { type: 'suffix', label: I18nService.t('rule_suffix') },
      { type: 'numbering', label: I18nService.t('rule_numbering') },
      { type: 'sanitize', label: I18nService.t('rule_sanitize') },
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

      default:
        return html``;
    }
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #fff;
      border-right: 1px solid #f0f0f0;
    }

    .config-panel {
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

    .panel-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }

    .panel-footer {
      padding: 16px;
      border-top: 1px solid #f0f0f0;
      flex-shrink: 0;
    }

    .rule-selector {
      margin-bottom: 24px;
    }

    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: #262626;
      margin-bottom: 12px;
    }

    .rule-options {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .rule-option {
      padding: 12px;
      border: 2px solid #d9d9d9;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .rule-option:hover {
      border-color: #1890ff;
    }

    .rule-option.selected {
      border-color: #1890ff;
      background-color: #e6f7ff;
      color: #1890ff;
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
      color: #595959;
      margin-bottom: 8px;
    }

    .form-input {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #d9d9d9;
      border-radius: 4px;
      font-size: 14px;
      transition: border-color 0.2s;
      box-sizing: border-box;
    }

    .form-select {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #d9d9d9;
      border-radius: 4px;
      font-size: 14px;
      transition: border-color 0.2s;
      box-sizing: border-box;
      background: #fff;
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
      color: #8c8c8c;
      margin-top: 4px;
      line-height: 1.5;
    }

    .warning-message {
      padding: 8px 12px;
      background: #fff7e6;
      border: 1px solid #ffd591;
      border-radius: 4px;
      color: #fa8c16;
      font-size: 13px;
      margin-bottom: 12px;
    }

    .button {
      width: 100%;
      padding: 10px 16px;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .button-primary {
      background: #1890ff;
      color: #fff;
    }

    .button-primary:hover:not(:disabled) {
      background: #40a9ff;
    }

    .button-primary:active:not(:disabled) {
      background: #096dd9;
    }

    .button:disabled {
      background: #f5f5f5;
      color: #bfbfbf;
      cursor: not-allowed;
    }

    .button-execute {
      font-size: 15px;
      padding: 12px 16px;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'config-panel': ConfigPanel;
  }
}
