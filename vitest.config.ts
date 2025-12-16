import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',

    // 测试超时配置
    testTimeout: 10000, // 10秒（默认5秒太短）
    hookTimeout: 10000,

    // 排除慢速测试（用于快速反馈）
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**', // E2E 测试由 Playwright 处理
      '**/performance/**', // 性能测试不在常规 CI 中运行
      // 暂时排除 quark-adapter 测试（需要 mock Chrome 扩展环境）
      '**/quark-adapter.test.ts', // Chrome 扩展消息通信需要特殊 mock 环境
    ],

    // 启用并行测试（加速执行）
    threads: true,
    maxThreads: 4,
    minThreads: 1,

    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '*.config.ts',
        '*.config.js',
      ],
    },
  },
});
