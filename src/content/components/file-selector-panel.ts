import { LitElement, html, css, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { FileItem, PlatformAdapter } from '../../types/platform';
import { FileType, PreviewItem } from '../../types/file-selector';
import { RuleConfig } from '../../types/rule';
import { RuleFactory } from '../../rules/rule-factory';
import { BatchExecutor, ExecutorState } from '../../core/executor';
import { BatchResults, ProgressEvent } from '../../types/core';
import { I18nService } from '../../utils/i18n';
import { parseFileName } from '../../utils/helpers';
import { logger } from '../../utils/logger';
import './config-panel';
import './file-list-panel';
import './preview-panel';

/**
 * File Selector Panel Component
 * Main three-panel container with complete state management
 *
 * @fires panel-close - Dispatched when panel is closed
 *
 * @example
 * ```html
 * <file-selector-panel
 *   .adapter=${adapter}
 *   @panel-close=${this.handleClose}>
 * </file-selector-panel>
 * ```
 */
@customElement('file-selector-panel')
export class FileSelectorPanel extends LitElement {
  /**
   * Platform adapter instance
   */
  @property({ type: Object })
  adapter!: PlatformAdapter;

  /**
   * Whether the panel is open
   */
  @property({ type: Boolean })
  open = false;

  /**
   * All files in current directory
   */
  @state()
  private allFiles: FileItem[] = [];

  /**
   * Set of file IDs that are unchecked (reverse storage pattern)
   */
  @state()
  private uncheckList: Set<string> = new Set();

  /**
   * Map of file ID to new filename
   */
  @state()
  private newNameMap: Map<string, string> = new Map();

  /**
   * Set of file IDs with naming conflicts
   */
  @state()
  private conflictIds: Set<string> = new Set();

  /**
   * Current search query
   */
  @state()
  private searchQuery = '';

  /**
   * Current file type filter
   */
  @state()
  private typeFilter: FileType | 'all' = 'all';

  /**
   * Current rule configuration
   */
  @state()
  private ruleConfig: RuleConfig = {
    type: 'replace',
    params: { search: '', replace: '', caseSensitive: false, global: true },
  };

  /**
   * Loading state
   */
  @state()
  private loading = false;

  /**
   * Executing state
   */
  @state()
  private executing = false;

  /**
   * Executor runtime state
   */
  @state()
  private executorState: ExecutorState = ExecutorState.IDLE;

  /**
   * Current execution progress
   */
  @state()
  private progress: ProgressEvent | null = null;

  /**
   * Items displayed during/after execution (with status)
   */
  @state()
  private executionItems: PreviewItem[] = [];

  /**
   * Last execution results (used for summary and sync)
   */
  @state()
  private executionResults: BatchResults | null = null;

  /**
   * Page list sync status after rename
   */
  @state()
  private syncStatus: 'idle' | 'syncing' | 'success' | 'failed' = 'idle';

  @state()
  private syncMessage: string | null = null;

  private executor: BatchExecutor | null = null;

  /**
   * Error message
   */
  @state()
  private error: string | null = null;

  /**
   * Computed: selected files
   */
  private get selectedFiles(): FileItem[] {
    // IMPORTANT: selection is scoped to the current (filtered) file list.
    // This keeps UI count/tri-state and execution scope consistent.
    return this.filteredFiles.filter(f => !this.uncheckList.has(f.id));
  }

  /**
   * Computed: filtered files (after search and type filter)
   */
  private get filteredFiles(): FileItem[] {
    return this.allFiles.filter(f => {
      // Search filter
      if (this.searchQuery && !f.name.toLowerCase().includes(this.searchQuery.toLowerCase())) {
        return false;
      }

      // Type filter
      if (this.typeFilter !== 'all') {
        const fileType = this.getFileType(f.ext);
        if (fileType !== this.typeFilter) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Computed: preview items
   */
  private get previewList(): PreviewItem[] {
    return this.selectedFiles
      .map(f => ({
        file: f,
        newName: this.newNameMap.get(f.id) || f.name,
        conflict: this.conflictIds.has(f.id),
      }))
      .filter(item => item.newName !== item.file.name);
  }

  private get executionFinished(): boolean {
    return this.executorState === ExecutorState.COMPLETED || this.executorState === ExecutorState.CANCELLED;
  }

  /**
   * Load all files when panel opens
   */
  async connectedCallback() {
    super.connectedCallback();

    if (this.open) {
      this.resetExecutionState();
      await this.loadAllFiles();
    }
  }

  protected updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);

    if (changedProperties.has('open') && this.open) {
      this.resetExecutionState();
      void this.loadAllFiles();
    }
  }

  /**
   * Load all files from API
   * @private
   */
  private async loadAllFiles(): Promise<void> {
    try {
      this.loading = true;
      this.error = null;

      if (!this.adapter) {
        throw new Error('Platform adapter is not set');
      }

      logger.info('[FileSelectorPanel] Loading all files from adapter');
      this.allFiles = await this.adapter.getAllFiles();

      logger.info(`[FileSelectorPanel] Loaded ${this.allFiles.length} files`);

      // Initialize with all files selected (reverse storage pattern)
      this.uncheckList = new Set();

      // Update preview
      this.updatePreview();
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.error = errorObj.message;
      logger.error('[FileSelectorPanel] Failed to load files:', errorObj);
    } finally {
      this.loading = false;
    }
  }

  /**
   * Get file type from extension
   * @private
   */
  private getFileType(ext: string): FileType {
    const lowerExt = ext.toLowerCase();

    const videoExts = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v'];
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp', '.ico'];
    const docExts = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.md'];

    if (videoExts.includes(lowerExt)) return 'video';
    if (imageExts.includes(lowerExt)) return 'image';
    if (docExts.includes(lowerExt)) return 'document';
    return 'other';
  }

  /**
   * Handle search
   * @private
   */
  private handleSearch(e: CustomEvent): void {
    this.searchQuery = e.detail.query;
    this.updatePreview();
  }

  /**
   * Handle select all
   * @private
   */
  private handleSelectAll(): void {
    // Select all in current (filtered) list.
    // Use reverse storage pattern: remove from uncheckList == select.
    const targets = this.filteredFiles;
    if (targets.length === 0) return;

    // Fast path: no filter/search -> select all.
    if (!this.searchQuery && this.typeFilter === 'all') {
      this.uncheckList = new Set();
      this.updatePreview();
      return;
    }

    const next = new Set(this.uncheckList);
    for (const file of targets) {
      next.delete(file.id);
    }
    this.uncheckList = next;
    this.updatePreview();
  }

  /**
   * Handle deselect all
   * @private
   */
  private handleDeselectAll(): void {
    // Deselect all in current (filtered) list.
    // Use reverse storage pattern: add to uncheckList == deselect.
    const targets = this.filteredFiles;
    if (targets.length === 0) return;

    // Fast path: no filter/search -> deselect all.
    if (!this.searchQuery && this.typeFilter === 'all') {
      this.uncheckList = new Set(this.allFiles.map(f => f.id));
      this.updatePreview();
      return;
    }

    const next = new Set(this.uncheckList);
    for (const file of targets) {
      next.add(file.id);
    }
    this.uncheckList = next;
    this.updatePreview();
  }

  /**
   * Handle type filter change
   * @private
   */
  private handleTypeFilter(e: CustomEvent): void {
    this.typeFilter = e.detail.type;
    this.updatePreview();
  }

  /**
   * Handle file toggle
   * @private
   */
  private handleFileToggle(e: CustomEvent): void {
    const { fileId } = e.detail;

    if (this.uncheckList.has(fileId)) {
      this.uncheckList.delete(fileId);
    } else {
      this.uncheckList.add(fileId);
    }

    // Trigger reactive update
    this.uncheckList = new Set(this.uncheckList);

    this.updatePreview();
  }

  /**
   * Handle config change
   * @private
   */
  private handleConfigChange(e: CustomEvent): void {
    this.ruleConfig = e.detail;
    this.updatePreview();
  }

  /**
   * Update preview based on current rule and selection
   * @private
   */
  private updatePreview(): void {
    const nextNameMap = new Map<string, string>();
    const selectedFiles = this.selectedFiles;

    if (selectedFiles.length === 0) {
      this.newNameMap = nextNameMap;
      this.conflictIds = new Set();
      return;
    }

    let rule: ReturnType<typeof RuleFactory.create> | null = null;
    try {
      rule = RuleFactory.create(this.ruleConfig);
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      // 规则参数尚未配置完成时（例如 Replace 的 search 为空），这是预期情况：不生成预览即可。
      if (errorObj.message === 'Invalid rule configuration') {
        this.newNameMap = nextNameMap;
        this.conflictIds = new Set();
        return;
      }
      logger.error('[FileSelectorPanel] Failed to create rule executor:', errorObj);
      this.newNameMap = nextNameMap;
      this.conflictIds = new Set();
      return;
    }

    try {
      // Apply rule to each selected file
      selectedFiles.forEach((file, index) => {
        const newName = rule!.execute(file.name, index, selectedFiles.length);
        nextNameMap.set(file.id, newName);
      });

      // Trigger reactive update
      this.newNameMap = nextNameMap;

      // Detect conflicts
      this.detectConflicts(selectedFiles);
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error('[FileSelectorPanel] Failed to update preview:', errorObj);
      this.newNameMap = nextNameMap;
      this.conflictIds = new Set();
    }
  }

  /**
   * Detect naming conflicts
   * @private
   */
  private detectConflicts(selectedFiles: FileItem[]): void {
    const nameMap = new Map<string, string>();
    const conflicts = new Set<string>();

    for (const file of selectedFiles) {
      const newName = this.newNameMap.get(file.id);
      if (!newName || newName === file.name) continue;

      if (nameMap.has(newName)) {
        // Conflict detected
        conflicts.add(file.id);
        conflicts.add(nameMap.get(newName)!);
      } else {
        nameMap.set(newName, file.id);
      }
    }

    this.conflictIds = conflicts;
  }

  /**
   * Handle execute
   * @private
   */
  private async handleExecute(): Promise<void> {
    if (this.executing || this.selectedFiles.length === 0) {
      return;
    }

    const executionPlan = this.previewList;
    if (executionPlan.length === 0) {
      alert(I18nService.t('no_rename_needed'));
      return;
    }

    // Confirm if there are conflicts
    if (this.conflictIds.size > 0) {
      const conflictMessage = `检测到 ${this.conflictIds.size} 个冲突，是否继续？`;
      const confirmed = confirm(conflictMessage);

      if (!confirmed) {
        return;
      }
    }

    try {
      this.resetExecutionState();
      this.executing = true;
      this.executorState = ExecutorState.RUNNING;

      this.executionItems = executionPlan.map((item) => ({
        ...item,
        done: undefined,
        error: undefined,
      }));
      this.progress = {
        completed: 0,
        total: this.executionItems.length,
        currentFile: '',
        success: 0,
        failed: 0,
      };

      // Execute batch rename
      const executor = new BatchExecutor(
        this.selectedFiles,
        this.ruleConfig,
        this.adapter,
        {
          requestInterval: this.adapter.getConfig().requestInterval,
          skipUnchanged: true,
          onProgress: (progress) => {
            this.handleProgress(progress);
          },
        }
      );
      this.executor = executor;

      const results = await executor.execute();
      this.executionResults = results;
      this.executorState = executor.getState();

      this.applyExecutionResults(results);
      void this.syncAfterRename();
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.error = errorObj.message;
      logger.error('[FileSelectorPanel] Execution failed:', errorObj);
    } finally {
      this.executing = false;
    }
  }

  private handleProgress(progress: ProgressEvent): void {
    this.progress = progress;

    if (!progress.fileId) {
      return;
    }

    this.executionItems = this.executionItems.map((item) => {
      if (item.file.id !== progress.fileId) {
        return item;
      }

      if (progress.status === 'success') {
        return { ...item, done: true, error: undefined };
      }

      if (progress.status === 'failed') {
        return { ...item, done: false, error: progress.error || I18nService.t('error_unknown') };
      }

      return item;
    });
  }

  private applyExecutionResults(results: BatchResults): void {
    const successById = new Map(results.success.map((r) => [r.fileId, r.renamed]));
    const failedById = new Map(results.failed.map((r) => [r.fileId, r.error]));

    this.executionItems = this.executionItems.map((item) => {
      const renamed = successById.get(item.file.id);
      if (renamed) {
        return { ...item, done: true, error: undefined };
      }

      const failed = failedById.get(item.file.id);
      if (failed) {
        return { ...item, done: false, error: failed };
      }

      return item;
    });

    if (successById.size > 0) {
      this.allFiles = this.allFiles.map((file) => {
        const nextName = successById.get(file.id);
        if (!nextName) return file;

        const { ext } = parseFileName(nextName);
        return {
          ...file,
          name: nextName,
          ext,
          mtime: Date.now(),
        };
      });

      // Refresh preview based on new filenames
      this.updatePreview();
    }
  }

  private async syncAfterRename(): Promise<void> {
    if (!this.executionResults || this.syncStatus === 'syncing') {
      return;
    }

    const renames = this.executionResults.success.map((r) => ({
      fileId: r.fileId,
      oldName: r.original,
      newName: r.renamed,
    }));

    if (renames.length === 0) {
      this.syncStatus = 'idle';
      this.syncMessage = null;
      return;
    }

    if (!this.adapter.syncAfterRename) {
      this.syncStatus = 'failed';
      this.syncMessage = I18nService.t('sync_not_supported');
      return;
    }

    try {
      this.syncStatus = 'syncing';
      this.syncMessage = null;

      const result = await this.adapter.syncAfterRename(renames);
      this.syncStatus = result.success ? 'success' : 'failed';
      this.syncMessage = result.success ? null : result.message || null;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.syncStatus = 'failed';
      this.syncMessage = errorObj.message;
    }
  }

  private handlePause(e: CustomEvent<{ isPaused: boolean }>): void {
    const isPaused = e.detail.isPaused;
    if (!this.executor) return;

    if (isPaused) {
      this.executor.pause();
    } else {
      this.executor.resume();
    }

    this.executorState = this.executor.getState();
  }

  private handleCancel(): void {
    if (!this.executor) return;

    const progress = this.progress;
    const total = progress?.total ?? 0;
    const completed = progress?.completed ?? 0;
    const success = progress?.success ?? 0;
    const failed = progress?.failed ?? 0;
    const remaining = Math.max(0, total - completed);

    const confirmMessage = `${I18nService.t('progress_cancel_confirm')}\n\n${I18nService.t('progress_cancel_stats', [
      String(success),
      String(failed),
      String(remaining),
    ])}`;

    if (!confirm(confirmMessage)) {
      return;
    }

    this.executor.cancel();
    this.executorState = this.executor.getState();
  }

  private handleSync(): void {
    void this.syncAfterRename();
  }

  private async handleRetryFailed(): Promise<void> {
    if (this.executing || !this.executionFinished) {
      return;
    }

    const failedIds = new Set(this.executionItems.filter((item) => item.done === false).map((item) => item.file.id));
    if (failedIds.size === 0) {
      return;
    }

    try {
      this.executing = true;
      this.executorState = ExecutorState.RUNNING;
      this.syncStatus = 'idle';
      this.syncMessage = null;

      // Reset only failed items back to pending
      this.executionItems = this.executionItems.map((item) => {
        if (!failedIds.has(item.file.id)) return item;
        return { ...item, done: undefined, error: undefined };
      });

      const tasks = this.executionItems
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => failedIds.has(item.file.id))
        .map(({ item, index }) => ({
          file: item.file,
          newName: item.newName,
          index,
        }));

      const retryFiles = tasks.map((task) => task.file);
      if (retryFiles.length === 0) {
        return;
      }

      this.progress = {
        completed: 0,
        total: retryFiles.length,
        currentFile: '',
        success: 0,
        failed: 0,
      };

      const executor = new BatchExecutor(retryFiles, this.ruleConfig, this.adapter, {
        requestInterval: this.adapter.getConfig().requestInterval,
        tasks,
        onProgress: (progress) => {
          this.handleProgress(progress);
        },
      });
      this.executor = executor;

      const results = await executor.execute();
      this.executionResults = results;
      this.executorState = executor.getState();

      this.applyExecutionResults(results);
      this.updateSummaryProgress();
      void this.syncAfterRename();
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.error = errorObj.message;
      logger.error('[FileSelectorPanel] Retry failed:', errorObj);
    } finally {
      this.executing = false;
    }
  }

  private handleBack(): void {
    this.resetExecutionState();
  }

  private updateSummaryProgress(): void {
    if (!this.executionItems.length) return;

    const success = this.executionItems.filter((item) => item.done === true).length;
    const failed = this.executionItems.filter((item) => item.done === false).length;
    const completed = success + failed;

    this.progress = {
      completed,
      total: this.executionItems.length,
      currentFile: '',
      success,
      failed,
    };
  }

  private resetExecutionState(): void {
    this.executor = null;
    this.executorState = ExecutorState.IDLE;
    this.progress = null;
    this.executionItems = [];
    this.executionResults = null;
    this.syncStatus = 'idle';
    this.syncMessage = null;
  }

  /**
   * Handle panel close
   * @private
   */
  private handleClose(): void {
    this.resetExecutionState();
    this.dispatchEvent(
      new CustomEvent('panel-close', {
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleOverlayClick(): void {
    if (this.executing) {
      return;
    }
    this.handleClose();
  }

  render() {
    if (!this.open) {
      return html``;
    }

    if (this.error) {
      return this.renderError();
    }

    const filteredFiles = this.filteredFiles;
    const filteredSelectedCount = filteredFiles.reduce(
      (count, file) => count + (this.uncheckList.has(file.id) ? 0 : 1),
      0
    );

    return html`
      <div class="panel-overlay" @click=${this.handleOverlayClick}>
        <div class="panel-container" @click=${(e: Event) => e.stopPropagation()}>
          <div class="panel-header">
            <h2 class="panel-title">${I18nService.t('file_selector_title')}</h2>
            <button class="close-button" @click=${this.handleClose} ?disabled=${this.executing}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div class="panel-body">
            <config-panel
              class="left-panel"
              .selectedCount=${this.selectedFiles.length}
              .conflictCount=${this.conflictIds.size}
              ?disabled=${this.loading}
              ?executing=${this.executing}
              .progress=${this.progress}
              .finished=${this.executionFinished}
              .paused=${this.executorState === ExecutorState.PAUSED}
              .syncStatus=${this.syncStatus}
              .syncMessage=${this.syncMessage}
              .syncSupported=${!!this.adapter.syncAfterRename}
              @config-change=${this.handleConfigChange}
              @execute=${this.handleExecute}
              @pause=${this.handlePause}
              @cancel=${this.handleCancel}
              @sync=${this.handleSync}
              @retry=${this.handleRetryFailed}
              @back=${this.handleBack}
            ></config-panel>

            <file-list-panel
              class="center-panel"
              .files=${filteredFiles}
              .uncheckList=${this.uncheckList}
              .searchQuery=${this.searchQuery}
              .typeFilter=${this.typeFilter}
              .selectedCount=${filteredSelectedCount}
              ?loading=${this.loading}
              ?disabled=${this.executing}
              @search=${this.handleSearch}
              @select-all=${this.handleSelectAll}
              @deselect-all=${this.handleDeselectAll}
              @type-filter=${this.handleTypeFilter}
              @file-toggle=${this.handleFileToggle}
            ></file-list-panel>

            <preview-panel
              class="right-panel"
              .items=${this.executionItems.length > 0 ? this.executionItems : this.previewList}
              .conflictCount=${this.conflictIds.size}
              .showStatus=${this.executing || this.executionFinished}
              ?loading=${false}
            ></preview-panel>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render error state
   * @private
   */
  private renderError() {
    return html`
      <div class="panel-overlay" @click=${this.handleClose}>
        <div class="error-container" @click=${(e: Event) => e.stopPropagation()}>
          <div class="error-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          </div>
          <h3>${I18nService.t('error_title')}</h3>
          <p>${this.error}</p>
          <div class="error-actions">
            <button class="button button-primary" @click=${() => this.loadAllFiles()}>
              ${I18nService.t('retry')}
            </button>
            <button class="button button-default" @click=${this.handleClose}>
              ${I18nService.t('close')}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
    }

    .panel-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    .panel-container {
      width: 95vw;
      height: 90vh;
      max-width: 1800px;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
      animation: slideUp 0.3s ease;
    }

    @keyframes slideUp {
      from {
        transform: translateY(20px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px;
      border-bottom: 1px solid #f0f0f0;
      flex-shrink: 0;
    }

    .panel-title {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      color: #262626;
    }

    .close-button {
      width: 32px;
      height: 32px;
      padding: 0;
      border: none;
      background: transparent;
      cursor: pointer;
      border-radius: 4px;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .close-button:hover:not(:disabled) {
      background: #f5f5f5;
    }

    .close-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .close-button svg {
      width: 20px;
      height: 20px;
      stroke-width: 2;
      color: #595959;
    }

    .panel-body {
      flex: 1;
      display: grid;
      grid-template-columns: 300px 1fr 1fr;
      overflow: hidden;
    }

    .left-panel,
    .center-panel,
    .right-panel {
      overflow: hidden;
    }

    .error-container {
      background: #fff;
      border-radius: 8px;
      padding: 40px;
      max-width: 500px;
      text-align: center;
      animation: slideUp 0.3s ease;
    }

    .error-icon {
      width: 64px;
      height: 64px;
      margin: 0 auto 20px;
      color: #ff4d4f;
    }

    .error-icon svg {
      width: 100%;
      height: 100%;
      stroke-width: 2;
    }

    .error-container h3 {
      margin: 0 0 12px 0;
      font-size: 20px;
      color: #262626;
    }

    .error-container p {
      margin: 0 0 24px 0;
      color: #595959;
      line-height: 1.6;
    }

    .error-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
    }

    .button {
      padding: 10px 20px;
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

    .button-primary:hover {
      background: #40a9ff;
    }

    .button-default {
      background: #fff;
      color: #595959;
      border: 1px solid #d9d9d9;
    }

    .button-default:hover {
      border-color: #1890ff;
      color: #1890ff;
    }

    @media (max-width: 1200px) {
      .panel-body {
        grid-template-columns: 280px 1fr 1fr;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'file-selector-panel': FileSelectorPanel;
  }
}
