import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E测试配置
 * 用于测试Chrome扩展的端到端功能
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // 扩展测试需要顺序执行
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // 扩展测试不支持并行
  reporter: 'html',

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Chrome扩展测试需要特殊配置
        launchOptions: {
          args: [
            `--disable-extensions-except=${process.cwd()}/dist`,
            `--load-extension=${process.cwd()}/dist`,
          ],
        },
      },
    },
  ],
});
