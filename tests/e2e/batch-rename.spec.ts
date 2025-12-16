import { test, expect } from '@playwright/test';

/**
 * E2E测试: 批量重命名完整流程
 *
 * 测试用户从选择文件到完成重命名的完整流程
 */

test.describe('批量重命名流程测试', () => {
  test.beforeEach(async ({ page }) => {
    // 导航到夸克网盘
    await page.goto('https://pan.quark.cn');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // 等待扩展注入
  });

  test('应该显示批量重命名按钮', async ({ page }) => {
    // 查找自定义的重命名按钮元素
    const renameButton = page.locator('rename-button');

    // 验证按钮存在
    await expect(renameButton).toBeVisible({ timeout: 5000 });
  });

  test('点击按钮应该打开重命名对话框', async ({ page }) => {
    // 等待并点击重命名按钮
    const renameButton = page.locator('rename-button');
    await renameButton.waitFor({ state: 'visible', timeout: 5000 });

    // 触发按钮点击
    await page.evaluate(() => {
      const button = document.querySelector('rename-button');
      if (button) {
        button.dispatchEvent(new Event('click'));
      }
    });

    // 等待对话框出现
    await page.waitForTimeout(1000);

    // 验证对话框存在
    const dialog = page.locator('rename-dialog');
    await expect(dialog).toBeVisible({ timeout: 3000 });
  });

  test('对话框应该包含所有必要的UI元素', async ({ page }) => {
    // 打开对话框
    await page.evaluate(() => {
      const button = document.querySelector('rename-button');
      if (button) {
        button.dispatchEvent(new Event('click'));
      }
    });

    await page.waitForTimeout(1000);

    const dialog = page.locator('rename-dialog');
    await dialog.waitFor({ state: 'visible', timeout: 3000 });

    // 验证对话框内部元素
    const shadowHost = await dialog.evaluateHandle((el) => el.shadowRoot);

    const hasTitle = await shadowHost.evaluate((root) => {
      return root?.querySelector('h2')?.textContent?.includes('批量重命名');
    });

    const hasRuleSelect = await shadowHost.evaluate((root) => {
      return root?.querySelector('select[name="rule"]') !== null;
    });

    const hasActionButtons = await shadowHost.evaluate((root) => {
      const confirmBtn = root?.querySelector('button.confirm');
      const cancelBtn = root?.querySelector('button.cancel');
      return confirmBtn !== null && cancelBtn !== null;
    });

    expect(hasTitle).toBe(true);
    expect(hasRuleSelect).toBe(true);
    expect(hasActionButtons).toBe(true);
  });

  test('应该能够选择不同的重命名规则', async ({ page }) => {
    // 打开对话框
    await page.evaluate(() => {
      const button = document.querySelector('rename-button');
      button?.dispatchEvent(new Event('click'));
    });

    await page.waitForTimeout(1000);

    // 获取shadow root中的select元素
    const ruleOptions = await page.evaluate(() => {
      const dialog = document.querySelector('rename-dialog');
      const select = dialog?.shadowRoot?.querySelector('select[name="rule"]') as HTMLSelectElement;
      if (!select) return [];

      return Array.from(select.options).map((opt) => opt.value);
    });

    // 验证有多个规则选项
    expect(ruleOptions.length).toBeGreaterThan(0);
    expect(ruleOptions).toContain('replace');
    expect(ruleOptions).toContain('prefix');
    expect(ruleOptions).toContain('suffix');
  });

  test('应该能够预览重命名结果', async ({ page }) => {
    // 打开对话框
    await page.evaluate(() => {
      const button = document.querySelector('rename-button');
      button?.dispatchEvent(new Event('click'));
    });

    await page.waitForTimeout(1000);

    // 设置规则并查看预览
    const hasPreview = await page.evaluate(() => {
      const dialog = document.querySelector('rename-dialog');
      const root = dialog?.shadowRoot;
      if (!root) return false;

      // 选择规则
      const select = root.querySelector('select[name="rule"]') as HTMLSelectElement;
      if (select) {
        select.value = 'prefix';
        select.dispatchEvent(new Event('change'));
      }

      // 填写参数
      const prefixInput = root.querySelector('input[name="prefix"]') as HTMLInputElement;
      if (prefixInput) {
        prefixInput.value = '测试_';
        prefixInput.dispatchEvent(new Event('input'));
      }

      // 检查是否有预览组件
      return root.querySelector('rename-preview') !== null;
    });

    expect(hasPreview).toBe(true);
  });

  test('应该能够取消重命名操作', async ({ page }) => {
    // 打开对话框
    await page.evaluate(() => {
      const button = document.querySelector('rename-button');
      button?.dispatchEvent(new Event('click'));
    });

    await page.waitForTimeout(1000);

    // 点击取消按钮
    const dialogClosed = await page.evaluate(() => {
      const dialog = document.querySelector('rename-dialog');
      const root = dialog?.shadowRoot;
      const cancelBtn = root?.querySelector('button.cancel') as HTMLButtonElement;

      if (cancelBtn) {
        cancelBtn.click();
        return true;
      }
      return false;
    });

    expect(dialogClosed).toBe(true);

    // 等待对话框关闭
    await page.waitForTimeout(500);

    // 验证对话框已关闭
    const dialogVisible = await page.evaluate(() => {
      const dialog = document.querySelector('rename-dialog');
      return dialog !== null && getComputedStyle(dialog).display !== 'none';
    });

    expect(dialogVisible).toBe(false);
  });
});
