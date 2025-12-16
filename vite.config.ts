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
      },
      output: {
        entryFileNames: (chunkInfo) => {
          return '[name].js';
        },
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
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
