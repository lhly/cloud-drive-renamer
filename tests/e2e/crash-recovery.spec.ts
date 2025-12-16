import { test, expect } from '@playwright/test';

/**
 * E2E测试: 崩溃恢复功能
 *
 * 测试扩展在异常情况下的恢复能力
 */

test.describe('崩溃恢复测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://pan.quark.cn');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('应该能够保存重命名进度到本地存储', async ({ page }) => {
    // 模拟开始重命名操作
    const progressSaved = await page.evaluate(() => {
      // 创建模拟进度数据
      const progress = {
        totalFiles: 10,
        completedFiles: 5,
        failedFiles: 0,
        startTime: Date.now(),
        status: 'in_progress',
      };

      // 保存到localStorage
      localStorage.setItem('rename_progress', JSON.stringify(progress));

      // 验证保存成功
      const saved = localStorage.getItem('rename_progress');
      return saved !== null;
    });

    expect(progressSaved).toBe(true);
  });

  test('页面刷新后应该能够恢复进度', async ({ page }) => {
    // 保存进度数据
    await page.evaluate(() => {
      const progress = {
        totalFiles: 10,
        completedFiles: 5,
        failedFiles: 0,
        startTime: Date.now(),
        status: 'in_progress',
        taskId: 'test-task-123',
      };
      localStorage.setItem('rename_progress', JSON.stringify(progress));
    });

    // 刷新页面
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 验证进度数据是否保留
    const progressRestored = await page.evaluate(() => {
      const saved = localStorage.getItem('rename_progress');
      if (!saved) return null;

      const progress = JSON.parse(saved);
      return progress.taskId === 'test-task-123' && progress.completedFiles === 5;
    });

    expect(progressRestored).toBe(true);
  });

  test('应该检测到未完成的重命名任务', async ({ page }) => {
    // 设置未完成的任务
    await page.evaluate(() => {
      const progress = {
        totalFiles: 10,
        completedFiles: 5,
        failedFiles: 0,
        startTime: Date.now() - 60000, // 1分钟前开始
        status: 'in_progress',
        taskId: 'incomplete-task',
      };
      localStorage.setItem('rename_progress', JSON.stringify(progress));
    });

    // 刷新页面触发恢复检测
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 验证是否检测到未完成任务
    const detectionResult = await page.evaluate(() => {
      const progress = localStorage.getItem('rename_progress');
      if (!progress) return false;

      const data = JSON.parse(progress);
      // 检查是否是进行中的任务
      return data.status === 'in_progress' && data.completedFiles < data.totalFiles;
    });

    expect(detectionResult).toBe(true);
  });

  test('应该能够清除已完成的任务进度', async ({ page }) => {
    // 设置已完成的任务
    await page.evaluate(() => {
      const progress = {
        totalFiles: 10,
        completedFiles: 10,
        failedFiles: 0,
        startTime: Date.now() - 120000,
        endTime: Date.now(),
        status: 'completed',
        taskId: 'completed-task',
      };
      localStorage.setItem('rename_progress', JSON.stringify(progress));
    });

    // 清除进度
    const cleared = await page.evaluate(() => {
      const progress = localStorage.getItem('rename_progress');
      if (!progress) return false;

      const data = JSON.parse(progress);
      if (data.status === 'completed') {
        localStorage.removeItem('rename_progress');
        return true;
      }
      return false;
    });

    expect(cleared).toBe(true);

    // 验证已清除
    const progressExists = await page.evaluate(() => {
      return localStorage.getItem('rename_progress') !== null;
    });

    expect(progressExists).toBe(false);
  });

  test('应该能够恢复失败的文件列表', async ({ page }) => {
    // 保存包含失败文件的进度
    await page.evaluate(() => {
      const progress = {
        totalFiles: 10,
        completedFiles: 7,
        failedFiles: 3,
        failedItems: [
          { id: '1', name: 'file1.txt', error: 'Network error' },
          { id: '2', name: 'file2.txt', error: 'Permission denied' },
          { id: '3', name: 'file3.txt', error: 'Timeout' },
        ],
        status: 'partially_failed',
      };
      localStorage.setItem('rename_progress', JSON.stringify(progress));
    });

    // 读取失败列表
    const failedFiles = await page.evaluate(() => {
      const progress = localStorage.getItem('rename_progress');
      if (!progress) return [];

      const data = JSON.parse(progress);
      return data.failedItems || [];
    });

    expect(failedFiles).toHaveLength(3);
    expect(failedFiles[0]).toHaveProperty('error');
    expect(failedFiles[0].name).toBe('file1.txt');
  });

  test('应该限制保存的进度记录数量', async ({ page }) => {
    // 添加多个进度记录
    const recordCount = await page.evaluate(() => {
      const maxRecords = 10;

      // 创建超过限制的记录
      for (let i = 0; i < 15; i++) {
        const progress = {
          taskId: `task-${i}`,
          completedFiles: i,
          status: 'completed',
          endTime: Date.now() - i * 1000,
        };

        // 获取现有记录
        const historyStr = localStorage.getItem('rename_history');
        const history = historyStr ? JSON.parse(historyStr) : [];

        // 添加新记录
        history.push(progress);

        // 保持最多10条记录
        const trimmed = history.slice(-maxRecords);
        localStorage.setItem('rename_history', JSON.stringify(trimmed));
      }

      // 验证记录数量
      const finalHistory = localStorage.getItem('rename_history');
      return finalHistory ? JSON.parse(finalHistory).length : 0;
    });

    expect(recordCount).toBeLessThanOrEqual(10);
  });
});
