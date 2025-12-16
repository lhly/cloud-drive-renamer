import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CrashRecoveryManager } from '../../src/core/crash-recovery';
import { OperationState } from '../../src/types/core';
import { storage } from '../../src/utils/storage';

// Mock storage
vi.mock('../../src/utils/storage', () => ({
  storage: {
    set: vi.fn(),
    get: vi.fn(),
    remove: vi.fn(),
  },
}));

// Mock logger
vi.mock('../../src/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('CrashRecoveryManager', () => {
  let recovery: CrashRecoveryManager;
  let mockState: OperationState;

  beforeEach(() => {
    recovery = new CrashRecoveryManager();
    mockState = {
      timestamp: Date.now(),
      platform: 'quark',
      files: [
        { id: '1', name: 'file1.txt' },
        { id: '2', name: 'file2.txt' },
        { id: '3', name: 'file3.txt' },
      ],
      rule: { type: 'prefix', params: { prefix: 'test_' } },
      completed: [0],
      failed: [],
    };

    // 重置mocks
    vi.clearAllMocks();
  });

  describe('saveOperationState', () => {
    it('应该保存操作状态', async () => {
      await recovery.saveOperationState(mockState);

      expect(storage.set).toHaveBeenCalledWith(
        'rename_operation_state',
        expect.objectContaining({
          platform: 'quark',
          files: mockState.files,
          rule: mockState.rule,
          completed: [0],
          failed: [],
        })
      );
    });

    it('保存时应该包含时间戳', async () => {
      await recovery.saveOperationState(mockState);

      expect(storage.set).toHaveBeenCalledWith(
        'rename_operation_state',
        expect.objectContaining({
          timestamp: expect.any(Number),
        })
      );
    });
  });

  describe('checkRecoverableOperation', () => {
    it('没有保存状态时应该返回null', async () => {
      vi.mocked(storage.get).mockResolvedValue(null);

      const result = await recovery.checkRecoverableOperation();

      expect(result).toBeNull();
    });

    it('状态超过30分钟应该返回null并清理', async () => {
      const oldState = {
        ...mockState,
        timestamp: Date.now() - 31 * 60 * 1000, // 31分钟前
      };
      vi.mocked(storage.get).mockResolvedValue(oldState);

      const result = await recovery.checkRecoverableOperation();

      expect(result).toBeNull();
      expect(storage.remove).toHaveBeenCalledWith('rename_operation_state');
    });

    it('30分钟内的状态应该返回', async () => {
      const recentState = {
        ...mockState,
        timestamp: Date.now() - 10 * 60 * 1000, // 10分钟前
      };
      vi.mocked(storage.get).mockResolvedValue(recentState);

      const result = await recovery.checkRecoverableOperation();

      expect(result).not.toBeNull();
      expect(result?.platform).toBe('quark');
    });

    it('已完成的操作应该返回null并清理', async () => {
      const completedState = {
        ...mockState,
        completed: [0, 1, 2], // 所有文件都完成
      };
      vi.mocked(storage.get).mockResolvedValue(completedState);

      const result = await recovery.checkRecoverableOperation();

      expect(result).toBeNull();
      expect(storage.remove).toHaveBeenCalled();
    });
  });

  describe('clearOperationState', () => {
    it('应该清除保存的状态', async () => {
      await recovery.clearOperationState();

      expect(storage.remove).toHaveBeenCalledWith('rename_operation_state');
    });
  });

  describe('getPendingFiles', () => {
    it('应该返回未完成的文件', () => {
      const pendingFiles = recovery.getPendingFiles(mockState);

      expect(pendingFiles.length).toBe(2); // file2和file3
      expect(pendingFiles[0].id).toBe('2');
      expect(pendingFiles[1].id).toBe('3');
    });

    it('所有文件完成时应该返回空数组', () => {
      const completedState = {
        ...mockState,
        completed: [0, 1, 2],
      };

      const pendingFiles = recovery.getPendingFiles(completedState);

      expect(pendingFiles.length).toBe(0);
    });
  });

  describe('markAsCompleted', () => {
    it('应该标记文件为已完成', async () => {
      vi.mocked(storage.get).mockResolvedValue(mockState);

      await recovery.markAsCompleted(1);

      expect(storage.set).toHaveBeenCalledWith(
        'rename_operation_state',
        expect.objectContaining({
          completed: [0, 1],
        })
      );
    });
  });

  describe('markAsFailed', () => {
    it('应该标记文件为失败', async () => {
      vi.mocked(storage.get).mockResolvedValue(mockState);

      await recovery.markAsFailed(1);

      expect(storage.set).toHaveBeenCalledWith(
        'rename_operation_state',
        expect.objectContaining({
          failed: [1],
        })
      );
    });
  });

  describe('showRecoveryDialog', () => {
    it('应该显示包含操作信息的对话框', () => {
      // Mock confirm
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

      const result = recovery.showRecoveryDialog(mockState);

      expect(result).toBe(true);
      expect(confirmSpy).toHaveBeenCalled();

      // 检查对话框消息包含关键信息
      const message = confirmSpy.mock.calls[0][0];
      expect(message).toContain('quark');
      expect(message).toContain('3'); // 总文件数
      expect(message).toContain('1'); // 已完成
      expect(message).toContain('2'); // 待完成

      confirmSpy.mockRestore();
    });
  });
});
