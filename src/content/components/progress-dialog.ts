import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ProgressEvent } from '../../types/core';
import { formatTime } from '../../utils/helpers';
import { I18nService } from '../../utils/i18n';

/**
 * 进度对话框组件
 *
 * 功能:
 * - 实时进度条显示
 * - 显示"已完成X/总数Y"
 * - 显示当前处理文件名
 * - 成功/失败统计
 * - 预计剩余时间(ETA)
 * - 暂停/取消按钮
 *
 * @example
 * ```html
 * <progress-dialog
 *   .progress="${progressData}"
 *   .startTime="${Date.now()}"
 *   @pause="${handlePause}"
 *   @cancel="${handleCancel}"
 * ></progress-dialog>
 * ```
 */
@customElement('progress-dialog')
export class ProgressDialog extends LitElement {
  /** 进度数据 */
  @property({ type: Object })
  progress!: ProgressEvent;

  /** 开始时间(用于ETA计算) */
  @property({ type: Number })
  startTime: number = Date.now();

  /** 是否可以暂停 */
  @property({ type: Boolean })
  pausable: boolean = true;

  /** 是否可以取消 */
  @property({ type: Boolean })
  cancellable: boolean = true;

  /** 是否已暂停 */
  @state()
  private isPaused: boolean = false;

  /**
   * Storage 变化监听器引用（用于清理）
   * 监听 storage 变化比监听消息更可靠，避免竞态条件
   */
  private storageChangeListener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if (areaName === 'local' && changes['language']) {
      // Storage 变化意味着 language 已经持久化
      // 全局监听器会更新 I18nService.currentLanguage
      // 这里只需触发重渲染
      this.requestUpdate();
    }
  };

  connectedCallback() {
    super.connectedCallback();

    // ✅ 修复：改用 storage 监听器替代消息监听器
    // 这避免了与全局监听器的竞态条件
    chrome.storage.onChanged.addListener(this.storageChangeListener);
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    // Clean up storage change listener to prevent memory leaks
    chrome.storage.onChanged.removeListener(this.storageChangeListener);
  }

  static styles = css`
    :host {
      display: block;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 10000;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .dialog {
      background: white;
      border-radius: 12px;
      padding: 24px;
      min-width: 480px;
      max-width: 600px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      animation: slideIn 0.3s ease-out;
    }

    @keyframes slideIn {
      from {
        transform: translateY(-20px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    .header {
      display: flex;
      align-items: center;
      margin-bottom: 24px;
    }

    .header h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      color: #333;
      flex: 1;
    }

    .spinner {
      width: 20px;
      height: 20px;
      border: 3px solid #f3f3f3;
      border-top: 3px solid #3498db;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-right: 12px;
    }

    @keyframes spin {
      0% {
        transform: rotate(0deg);
      }
      100% {
        transform: rotate(360deg);
      }
    }

    .progress-bar-container {
      width: 100%;
      height: 8px;
      background: #f0f0f0;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 16px;
    }

    .progress-bar {
      height: 100%;
      background: linear-gradient(90deg, #3498db, #2ecc71);
      transition: width 0.3s ease;
      border-radius: 4px;
    }

    .progress-text {
      display: flex;
      justify-content: space-between;
      margin-bottom: 16px;
      font-size: 14px;
      color: #666;
    }

    .percentage {
      font-size: 18px;
      font-weight: 600;
      color: #333;
    }

    .current-file {
      background: #f8f9fa;
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 16px;
      font-size: 13px;
      color: #666;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .current-file strong {
      color: #333;
      margin-right: 8px;
    }

    .stats {
      display: flex;
      gap: 24px;
      margin-bottom: 16px;
      padding: 12px;
      background: #f8f9fa;
      border-radius: 6px;
    }

    .stat-item {
      flex: 1;
      text-align: center;
    }

    .stat-label {
      font-size: 12px;
      color: #999;
      margin-bottom: 4px;
    }

    .stat-value {
      font-size: 20px;
      font-weight: 600;
    }

    .stat-value.success {
      color: #2ecc71;
    }

    .stat-value.failed {
      color: #e74c3c;
    }

    .eta {
      text-align: center;
      font-size: 14px;
      color: #666;
      margin-bottom: 20px;
    }

    .eta strong {
      color: #333;
    }

    .actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }

    button {
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    button:hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }

    button:active {
      transform: translateY(0);
    }

    .btn-pause {
      background: #3498db;
      color: white;
    }

    .btn-pause:hover {
      background: #2980b9;
    }

    .btn-pause.paused {
      background: #2ecc71;
    }

    .btn-pause.paused:hover {
      background: #27ae60;
    }

    .btn-cancel {
      background: #e74c3c;
      color: white;
    }

    .btn-cancel:hover {
      background: #c0392b;
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none !important;
    }
  `;

  render() {
    if (!this.progress) {
      return html``;
    }

    const percentage = this.calculatePercentage();
    const eta = this.calculateETA();

    return html`
      <div class="dialog">
        <div class="header">
          <div class="spinner"></div>
          <h2>${I18nService.t('progress_dialog_title')}</h2>
        </div>

        <div class="progress-bar-container">
          <div class="progress-bar" style="width: ${percentage}%"></div>
        </div>

        <div class="progress-text">
          <span class="percentage">${percentage.toFixed(1)}%</span>
          <span>${this.progress.completed} / ${this.progress.total}</span>
        </div>

        <div class="current-file">
          <strong>${I18nService.t('progress_current_file')}</strong>${this.progress.currentFile}
        </div>

        <div class="stats">
          <div class="stat-item">
            <div class="stat-label">${I18nService.t('progress_completed')}</div>
            <div class="stat-value">${this.progress.completed}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">${I18nService.t('progress_success')}</div>
            <div class="stat-value success">${this.progress.success}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">${I18nService.t('progress_failed')}</div>
            <div class="stat-value failed">${this.progress.failed}</div>
          </div>
        </div>

        <div class="eta"><strong>${I18nService.t('progress_eta')}</strong> ${eta}</div>

        <div class="actions">
          ${this.pausable
            ? html`
                <button
                  class="btn-pause ${this.isPaused ? 'paused' : ''}"
                  @click=${this.handlePause}
                >
                  ${this.isPaused ? I18nService.t('progress_button_resume') : I18nService.t('progress_button_pause')}
                </button>
              `
            : ''}
          ${this.cancellable
            ? html`
                <button class="btn-cancel" @click=${this.handleCancel}>${I18nService.t('progress_button_cancel')}</button>
              `
            : ''}
        </div>
      </div>
    `;
  }

  /**
   * 计算进度百分比
   */
  private calculatePercentage(): number {
    if (this.progress.total === 0) {
      return 0;
    }
    return (this.progress.completed / this.progress.total) * 100;
  }

  /**
   * 计算预计剩余时间
   */
  private calculateETA(): string {
    if (this.progress.completed === 0) {
      return I18nService.t('progress_calculating');
    }

    const elapsed = Date.now() - this.startTime;
    const avgTimePerFile = elapsed / this.progress.completed;
    const remainingFiles = this.progress.total - this.progress.completed;
    const remainingMs = avgTimePerFile * remainingFiles;

    return formatTime(remainingMs);
  }

  /**
   * 处理暂停/继续
   */
  private handlePause() {
    this.isPaused = !this.isPaused;
    this.dispatchEvent(
      new CustomEvent('pause', {
        detail: {
          isPaused: this.isPaused,
        },
      })
    );
  }

  /**
   * 处理取消
   */
  private handleCancel() {
    const confirmMessage = `${I18nService.t('progress_cancel_confirm')}\n\n${I18nService.t('progress_cancel_stats', [
      String(this.progress.success),
      String(this.progress.failed),
      String(this.progress.total - this.progress.completed)
    ])}`;

    const confirmed = confirm(confirmMessage);

    if (confirmed) {
      this.dispatchEvent(new CustomEvent('cancel'));
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'progress-dialog': ProgressDialog;
  }
}
