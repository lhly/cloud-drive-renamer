import { FileItem, PlatformAdapter } from '../types/platform';
import { RuleConfig } from '../types/rule';
import { ProgressEvent, BatchResults, Task } from '../types/core';
import { sleep } from '../utils/helpers';
import { RuleFactory } from '../rules/rule-factory';

/**
 * 批量执行引擎配置
 */
export interface BatchExecutorOptions {
  /** 请求间隔(毫秒) */
  requestInterval: number;
  /** 最大并发请求数（默认从平台配置读取，兜底为 3） */
  maxConcurrent?: number;
  /** 是否跳过无需变更的任务（默认不跳过，保持与平台行为一致） */
  skipUnchanged?: boolean;
  /** 自定义任务列表（可选，用于重试等场景，优先级高于 rule 生成的任务） */
  tasks?: Task[];
  /** 进度回调 */
  onProgress?: (progress: ProgressEvent) => void;
  /** 完成回调 */
  onComplete?: (results: BatchResults) => void;
  /** 错误回调 */
  onError?: (error: Error) => void;
}

/**
 * 批量执行状态
 */
export enum ExecutorState {
  IDLE = 'idle',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

/**
 * 批量重命名执行引擎
 *
 * 核心功能:
 * - 800ms请求间隔控制
 * - 最大并发控制（默认 3，可配置）
 * - 进度事件系统
 * - 支持暂停/恢复/取消功能
 *
 * @example
 * ```typescript
 * const executor = new BatchExecutor(files, rule, adapter, {
 *   requestInterval: 800,
 *   onProgress: (progress) => {
 *     console.log(`Progress: ${progress.completed}/${progress.total}`);
 *   },
 *   onComplete: (results) => {
 *     console.log(`Success: ${results.success.length}, Failed: ${results.failed.length}`);
 *   }
 * });
 *
 * await executor.execute();
 * ```
 */
export class BatchExecutor {
  private state: ExecutorState = ExecutorState.IDLE;
  private results: BatchResults = {
    success: [],
    failed: [],
  };
  private startTime: number = 0;
  private tasks: Task[] = [];
  private pausePromise: Promise<void> | null = null;
  private pauseResolver: (() => void) | null = null;
  private abortController: AbortController | null = null;
  private rateLimitChain: Promise<void> = Promise.resolve();
  private lastRequestStartAt = 0;

  private isCancelled(): boolean {
    return this.state === ExecutorState.CANCELLED;
  }

  constructor(
    private files: FileItem[],
    private rule: RuleConfig,
    private adapter: PlatformAdapter,
    private options: BatchExecutorOptions
  ) {
    if (!files || files.length === 0) {
      throw new Error('Files array cannot be empty');
    }
    if (!rule) {
      throw new Error('Rule configuration is required');
    }
    if (!adapter) {
      throw new Error('Platform adapter is required');
    }
  }

  /**
   * 执行批量重命名
   * @returns 批量执行结果
   */
  async execute(): Promise<BatchResults> {
    if (this.state === ExecutorState.RUNNING) {
      throw new Error('Executor is already running');
    }

    this.state = ExecutorState.RUNNING;
    this.startTime = Date.now();
    this.abortController = new AbortController();
    this.results = { success: [], failed: [] };
    this.tasks = [];
    this.rateLimitChain = Promise.resolve();
    this.lastRequestStartAt = 0;

    try {
      // 准备所有重命名任务
      const preparedTasks = this.options.tasks ?? this.prepareTasks();
      const tasks = this.options.skipUnchanged
        ? preparedTasks.filter((task) => task.newName !== task.file.name)
        : preparedTasks;
      this.tasks = tasks;

      if (tasks.length === 0) {
        this.state = ExecutorState.COMPLETED;
        this.options.onComplete?.(this.results);
        return this.results;
      }

      // 并发执行（限制最大并发 + 全局请求间隔）
      const maxConcurrent = this.getMaxConcurrent(tasks.length);
      let cursor = 0;

      const runWorker = async () => {
        for (;;) {
          const task = tasks[cursor++];
          if (!task) return;

          // 取消/暂停检查
          if (this.isCancelled()) return;
          if (this.state === ExecutorState.PAUSED && this.pausePromise) {
            await this.pausePromise;
          }
          if (this.isCancelled()) return;

          // 全局节流：确保相邻请求的 start 间隔 >= requestInterval
          await this.waitForRequestSlot();

          // 再次检查（避免在等待 slot 期间被暂停/取消）
          if (this.isCancelled()) return;
          if (this.state === ExecutorState.PAUSED && this.pausePromise) {
            await this.pausePromise;
          }
          if (this.isCancelled()) return;

          await this.processTask(task);
        }
      };

      const workers = Array.from({ length: maxConcurrent }, () => runWorker());
      await Promise.allSettled(workers);

      // 保持 CANCELLED 状态，避免被覆盖为 COMPLETED
      if (!this.isCancelled()) {
        this.state = ExecutorState.COMPLETED;
      }
      this.options.onComplete?.(this.results);

      return this.results;
    } catch (error) {
      this.state = ExecutorState.COMPLETED;
      this.options.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * 暂停执行
   */
  pause(): void {
    if (this.state !== ExecutorState.RUNNING) {
      return;
    }

    this.state = ExecutorState.PAUSED;
    this.pausePromise = new Promise((resolve) => {
      this.pauseResolver = resolve;
    });
  }

  /**
   * 恢复执行
   */
  resume(): void {
    if (this.state !== ExecutorState.PAUSED) {
      return;
    }

    this.state = ExecutorState.RUNNING;
    if (this.pauseResolver) {
      this.pauseResolver();
      this.pauseResolver = null;
      this.pausePromise = null;
    }
  }

  /**
   * 取消执行
   */
  cancel(): void {
    if (this.state === ExecutorState.COMPLETED || this.state === ExecutorState.CANCELLED) {
      return;
    }

    this.state = ExecutorState.CANCELLED;
    this.abortController?.abort();
    if (this.pauseResolver) {
      this.pauseResolver();
      this.pauseResolver = null;
      this.pausePromise = null;
    }
  }

  /**
   * 获取当前状态
   */
  getState(): ExecutorState {
    return this.state;
  }

  /**
   * 获取当前结果
   */
  getResults(): BatchResults {
    return this.results;
  }

  /**
   * 准备所有任务
   * @private
   */
  private prepareTasks(): Task[] {
    const ruleExecutor = RuleFactory.create(this.rule);

    const tasks = this.files.map((file, index) => ({
      file,
      newName: ruleExecutor.execute(file.name, index, this.files.length),
      index,
    }));

    if (this.options.skipUnchanged) {
      return tasks.filter((task) => task.newName !== task.file.name);
    }

    return tasks;
  }

  /**
   * 延迟执行重命名
   * @private
   */
  private async processTask(task: Task): Promise<void> {
    try {
      const result = await this.adapter.renameFile(task.file.id, task.newName);

      if (result.success) {
        this.results.success.push({
          fileId: task.file.id,
          original: task.file.name,
          renamed: task.newName,
          index: task.index,
        });
        this.emitProgress(task, 'success');
      } else {
        const errorMessage = result.error?.message || 'Unknown error';
        this.results.failed.push({
          fileId: task.file.id,
          file: task.file,
          error: errorMessage,
          index: task.index,
        });
        this.emitProgress(task, 'failed', errorMessage);
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      this.results.failed.push({
        fileId: task.file.id,
        file: task.file,
        error: errorMessage,
        index: task.index,
      });
      this.emitProgress(task, 'failed', errorMessage);
    }
  }

  private getMaxConcurrent(taskCount: number): number {
    const fallback = this.adapter.getConfig().maxConcurrent ?? 3;
    const raw = this.options.maxConcurrent ?? fallback;
    const n = Math.max(1, Math.trunc(raw));
    return Math.min(n, Math.max(1, taskCount));
  }

  private async waitForRequestSlot(): Promise<void> {
    const interval = this.options.requestInterval;
    if (!interval || interval <= 0) {
      return;
    }

    const doWait = async () => {
      const now = Date.now();

      if (this.lastRequestStartAt > 0) {
        const delta = now - this.lastRequestStartAt;
        const delay = interval - delta;
        if (delay > 0) {
          await sleep(delay);
        }
      }

      this.lastRequestStartAt = Date.now();
    };

    const chained = this.rateLimitChain.then(doWait, doWait);
    this.rateLimitChain = chained;
    await chained;
  }

  /**
   * 发射进度事件
   * @private
   */
  private emitProgress(task: Task, status: 'success' | 'failed', errorMessage?: string): void {
    const progress: ProgressEvent = {
      completed: this.results.success.length + this.results.failed.length,
      total: this.tasks.length || this.files.length,
      currentFile: task.file.name,
      success: this.results.success.length,
      failed: this.results.failed.length,
      fileId: task.file.id,
      newName: task.newName,
      status,
      error: status === 'failed' ? errorMessage : undefined,
    };

    this.options.onProgress?.(progress);
  }

  /**
   * 计算预计剩余时间(毫秒)
   */
  getEstimatedTimeRemaining(): number {
    const completed = this.results.success.length + this.results.failed.length;
    if (completed === 0) {
      return 0;
    }

    const elapsed = Date.now() - this.startTime;
    const avgTimePerFile = elapsed / completed;
    const total = this.tasks.length || this.files.length;
    const remaining = total - completed;

    return Math.ceil(avgTimePerFile * remaining);
  }

  /**
   * 获取执行统计
   */
  getStatistics() {
    const completed = this.results.success.length + this.results.failed.length;
    const total = this.tasks.length || this.files.length;
    const elapsed = Date.now() - this.startTime;

    return {
      completed,
      total,
      success: this.results.success.length,
      failed: this.results.failed.length,
      percentage: total > 0 ? (completed / total) * 100 : 0,
      elapsed,
      estimatedRemaining: this.getEstimatedTimeRemaining(),
      avgTimePerFile: completed > 0 ? elapsed / completed : 0,
    };
  }
}
