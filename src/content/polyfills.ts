/**
 * Web Components Polyfill
 * 使用智能加载器，仅在需要时加载polyfill
 *
 * webcomponents-loader.js特性：
 * - 自动检测浏览器原生支持（Chrome 67+原生支持Web Components）
 * - 现代浏览器：0KB开销（无需polyfill）
 * - 旧浏览器：按需加载必需的polyfill（15-50KB）
 * - loader本身：仅2-3KB
 *
 * 相比webcomponents-bundle.js（137KB）：
 * - 现代Chrome：节省99%体积（137KB → 2KB）
 * - 旧浏览器：节省约60%体积（137KB → 50KB）
 */

import '@webcomponents/webcomponentsjs/webcomponents-loader.js';

// 等待Web Components Ready事件
window.addEventListener('WebComponentsReady', () => {
});

// 检测polyfill加载状态（非阻塞式检测）
if (typeof customElements === 'undefined' || customElements === null) {
  console.warn('[CDR] Web Components polyfill loading asynchronously...');
  // 注意：这是正常的，loader会异步加载必要的polyfill
  // 实际的API可用性检查应该在使用时进行（见index.ts的openRenameDialog）
} else {
  // Polyfill 已加载，可以直接使用 customElements
}

export {};
