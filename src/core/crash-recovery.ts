import { PlatformAdapter } from '../types/platform';
import { OperationState } from '../types/core';
import { storage } from '../utils/storage';
import { logger } from '../utils/logger';
import { BatchExecutor } from './executor';

/**
 * 崩溃恢复管理器
 *
 * 核心功能:
 * - 操作状态持久化到chrome.storage.local
 * - 检测可恢复的操作(30分钟内)
 * - 恢复未完成的操作
 * - 幂等性检查避免重复重命名
 *
 * @example
 * ```typescript
 * const recovery = new CrashRecoveryManager();
 *
 * // 页面加载时检查恢复
 * const savedOp = await recovery.checkRecoverableOperation();
 * if (savedOp) {
 *   const shouldResume = recovery.showRecoveryDialog(savedOp);
 *   if (shouldResume) {
 *     await recovery.resumeOperation(savedOp, adapter);
 *   } else {
 *     await recovery.clearOperationState();
 *   }
 * }
 * ```
 */
export class CrashRecoveryManager {
  private readonly STORAGE_KEY = 'rename_operation_state';
  private readonly MAX_AGE_MINUTES = 30;

  /**
   * 保存操作状态
   * @param state 操作状态
   */
  async saveOperationState(state: OperationState): Promise<void> {
    try {
      const data: OperationState = {
        timestamp: Date.now(),
        platform: state.platform,
        files: state.files,
        rule: state.rule,
        completed: state.completed,
        failed: state.failed,
      };

      await storage.set(this.STORAGE_KEY, data);
    } catch (error) {
      logger.error('Failed to save operation state:', error as Error);
    }
  }

  /**
   * 检查是否有可恢复的操作
   * @returns 可恢复的操作状态,如果没有则返回null
   */
  async checkRecoverableOperation(): Promise<OperationState | null> {
    try {
      const savedData = await storage.get<OperationState>(this.STORAGE_KEY);

      if (!savedData) {
        return null;
      }

      const ageMinutes = (Date.now() - savedData.timestamp) / 60000;

      // 只恢复30分钟内的操作
      if (ageMinutes > this.MAX_AGE_MINUTES) {
        logger.info('Saved operation is too old, clearing');
        await this.clearOperationState();
        return null;
      }

      // 检查是否有未完成的文件
      const totalCompleted = savedData.completed.length + savedData.failed.length;
      if (totalCompleted >= savedData.files.length) {
        await this.clearOperationState();
        return null;
      }

      logger.info('Recoverable operation found', {
        age: `${ageMinutes.toFixed(1)} minutes`,
        files: savedData.files.length,
        completed: savedData.completed.length,
        failed: savedData.failed.length,
      });

      return savedData;
    } catch (error) {
      logger.error('Failed to check recoverable operation:', error as Error);
      return null;
    }
  }

  /**
   * 恢复操作
   * @param savedState 保存的操作状态
   * @param adapter 平台适配器
   * @param onProgress 进度回调
   * @param onComplete 完成回调
   */
  async resumeOperation(
    savedState: OperationState,
    adapter: PlatformAdapter,
    onProgress?: (progress: any) => void,
    onComplete?: (results: any) => void
  ): Promise<void> {
    // 过滤出未完成的文件
    const completedSet = new Set([...savedState.completed, ...savedState.failed]);
    const pendingFiles = savedState.files.filter((_file: any, index: number) => !completedSet.has(index));

    if (pendingFiles.length === 0) {
      await this.clearOperationState();
      return;
    }

    logger.info('Resuming operation', {
      pending: pendingFiles.length,
      completed: savedState.completed.length,
      failed: savedState.failed.length,
    });

    // 创建新的executor继续执行
    const executor = new BatchExecutor(pendingFiles, savedState.rule, adapter, {
      requestInterval: 800,
      onProgress: (progress) => {
        // 转发进度事件
        onProgress?.(progress);

        // 更新进度到存储
        const currentIndex = savedState.files.findIndex(
          (f: any) => f.id === pendingFiles[progress.completed - 1]?.id
        );
        if (currentIndex !== -1) {
          const isFailed = progress.failed > 0;
          if (isFailed) {
            this.markAsFailed(currentIndex);
          } else {
            this.markAsCompleted(currentIndex);
          }
        }
      },
      onComplete: async (results) => {
        // 完成后清理状态
        await this.clearOperationState();
        onComplete?.(results);
      },
    });

    await executor.execute();
  }

  /**
   * 使用幂等性检查重命名文件
   * @param fileId 文件ID
   * @param expectedOldName 期望的旧文件名
   * @param newName 新文件名
   * @param adapter 平台适配器
   */
  async renameWithIdempotency(
    fileId: string,
    expectedOldName: string,
    newName: string,
    adapter: PlatformAdapter
  ): Promise<any> {
    try {
      // 1. 获取当前文件信息
      const currentFile = await adapter.getFileInfo(fileId);

      // 2. 如果已经是目标名称,跳过
      if (currentFile.name === newName) {
        logger.info('File already renamed', { fileId, newName });
        return {
          success: true,
          skipped: true,
          reason: 'already_renamed',
        };
      }

      // 3. 如果文件名不匹配,警告
      if (currentFile.name !== expectedOldName) {
        logger.warn('File name mismatch', {
          fileId,
          expected: expectedOldName,
          actual: currentFile.name,
        });
        return {
          success: false,
          reason: 'name_mismatch',
          error: new Error(`Expected ${expectedOldName}, got ${currentFile.name}`),
        };
      }

      // 4. 执行重命名
      return await adapter.renameFile(fileId, newName);
    } catch (error) {
      logger.error('Idempotent rename failed:', error as Error);
      return {
        success: false,
        error: error as Error,
      };
    }
  }

  /**
   * 显示恢复对话框
   * @param savedState 保存的操作状态
   * @returns 用户是否选择恢复
   */
  showRecoveryDialog(savedState: OperationState): boolean {
    const totalCompleted = savedState.completed.length + savedState.failed.length;
    const remaining = savedState.files.length - totalCompleted;
    const ageMinutes = Math.floor((Date.now() - savedState.timestamp) / 60000);

    const message =
      `检测到未完成的批量重命名操作:\n\n` +
      `平台: ${savedState.platform}\n` +
      `总文件数: ${savedState.files.length}\n` +
      `已完成: ${savedState.completed.length}\n` +
      `已失败: ${savedState.failed.length}\n` +
      `待完成: ${remaining}\n` +
      `操作时间: ${ageMinutes}分钟前\n\n` +
      `是否继续执行?`;

    return confirm(message);
  }

  /**
   * 清除操作状态
   */
  async clearOperationState(): Promise<void> {
    try {
      await storage.remove(this.STORAGE_KEY);
    } catch (error) {
      logger.error('Failed to clear operation state:', error as Error);
    }
  }

  /**
   * 获取待完成的文件列表
   * @param savedState 保存的操作状态
   * @returns 待完成的文件数组
   */
  getPendingFiles(savedState: OperationState): any[] {
    return savedState.files.filter((_, index) => !savedState.completed.includes(index));
  }

  /**
   * 更新完成状态
   * @param index 文件索引
   */
  async markAsCompleted(index: number): Promise<void> {
    try {
      const state = await storage.get<OperationState>(this.STORAGE_KEY);
      if (state) {
        state.completed.push(index);
        await storage.set(this.STORAGE_KEY, state);
      }
    } catch (error) {
      logger.error('Failed to mark as completed:', error as Error);
    }
  }

  /**
   * 更新失败状态
   * @param index 文件索引
   */
  async markAsFailed(index: number): Promise<void> {
    try {
      const state = await storage.get<OperationState>(this.STORAGE_KEY);
      if (state) {
        state.failed.push(index);
        await storage.set(this.STORAGE_KEY, state);
      }
    } catch (error) {
      logger.error('Failed to mark as failed:', error as Error);
    }
  }
}

/**
 * 在页面加载时自动检测崩溃恢复
 * @param adapter 平台适配器
 */
export async function initCrashRecovery(adapter: PlatformAdapter): Promise<void> {
  const recovery = new CrashRecoveryManager();
  const savedOp = await recovery.checkRecoverableOperation();

  if (savedOp) {
    const shouldResume = recovery.showRecoveryDialog(savedOp);

    if (shouldResume) {
      try {
        await recovery.resumeOperation(savedOp, adapter);
      } catch (error) {
        logger.error('Failed to resume operation:', error as Error);
        await recovery.clearOperationState();
      }
    } else {
      await recovery.clearOperationState();
    }
  }
}

export const crashRecovery = new CrashRecoveryManager();
