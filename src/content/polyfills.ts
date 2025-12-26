/**
 * Web Components Polyfill
 *
 * 注意：不要在这里使用 `@webcomponents/webcomponentsjs/webcomponents-loader.js`
 * 因为 loader 会通过 `document.querySelector('script[src*=\"webcomponents-loader.js\"]')`
 * 推断自身的加载路径以拼接 bundles 路径。
 *
 * 在本项目中 polyfill 通过 Vite 动态 import 打包成 chunk（没有对应的 <script src=\"...webcomponents-loader.js\">），
 * 会导致 script 查询结果为 null，进而触发：
 * `TypeError: Cannot read properties of null (reading 'src')`
 *
 * 这里改为直接加载 `webcomponents-bundle.js`，避免依赖 <script src> 推断路径。
 * 该文件内部同样会在完成后派发 `WebComponentsReady` 事件。
 */

import '@webcomponents/webcomponentsjs/webcomponents-bundle.js';

// 检测 polyfill 加载状态（非阻塞式）
if (typeof customElements === 'undefined' || customElements === null) {
  console.warn('[CDR] Web Components polyfill loading asynchronously...');
}

export {};
