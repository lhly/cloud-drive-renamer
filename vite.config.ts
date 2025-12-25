import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [crx({ manifest: manifest as any })],
  build: {
    rollupOptions: {
      input: {
        popup: 'src/popup/index.html',
        dialog: 'src/dialog/index.html',
        // ✅ 添加 page-script 作为显式入口点
        'page-script-aliyun': 'src/adapters/aliyun/page-script.ts',
        'page-script-baidu': 'src/adapters/baidu/page-script.ts',
        'page-script-quark': 'src/adapters/quark/page-script.ts',
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // ✅ 为 page-script 生成正确的输出路径
          if (chunkInfo.name.startsWith('page-script-')) {
            const platform = chunkInfo.name.replace('page-script-', '');
            return `src/adapters/${platform}/page-script.js`;
          }
          return '[name].js';
        },
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
    // 仅在开发环境生成 source maps，生产环境禁用以减小包体积
    sourcemap: process.env.NODE_ENV === 'development',
    // 确保将node_modules中的依赖正确打包
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  // 确保webcomponents polyfill被正确处理
  optimizeDeps: {
    include: ['@webcomponents/webcomponentsjs'],
  },
  server: {
    port: 5173,
    hmr: {
      host: 'localhost',
    },
  },
});
