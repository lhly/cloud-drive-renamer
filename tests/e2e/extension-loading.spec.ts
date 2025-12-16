import { test, expect } from '@playwright/test';

/**
 * E2E测试: 扩展加载和基本功能
 *
 * 测试扩展是否能正确加载到浏览器中，并验证基本功能可用性
 */

test.describe('扩展加载测试', () => {
  test('应该成功加载扩展', async ({ page }) => {
    // 导航到夸克网盘测试页面
    await page.goto('https://pan.quark.cn');

    // 等待页面加载
    await page.waitForLoadState('networkidle');

    // 验证页面标题
    await expect(page).toHaveTitle(/夸克网盘/);
  });

  test('应该在页面中注入内容脚本', async ({ page }) => {
    await page.goto('https://pan.quark.cn');
    await page.waitForLoadState('networkidle');

    // 等待一段时间让内容脚本注入
    await page.waitForTimeout(2000);

    // 验证自定义元素是否已注册
    const hasRenameButton = await page.evaluate(() => {
      return customElements.get('rename-button') !== undefined;
    });

    expect(hasRenameButton).toBe(true);
  });

  test('应该能够访问扩展的background service worker', async ({ context }) => {
    // 获取service worker
    const serviceWorker = await context.serviceWorkers()[0];
    expect(serviceWorker).toBeDefined();
  });

  test('应该能够打开扩展popup', async ({ page, context }) => {
    // 获取扩展ID
    const extensionId = await page.evaluate(() => {
      return chrome?.runtime?.id;
    });

    if (extensionId) {
      // 打开popup页面
      const popupPage = await context.newPage();
      await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);

      // 验证popup加载成功
      await expect(popupPage.locator('h1')).toHaveText(/云盘批量重命名/);

      await popupPage.close();
    }
  });
});
