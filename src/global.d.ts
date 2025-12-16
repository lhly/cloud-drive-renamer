/**
 * 全局类型声明
 */

/**
 * Web Components Polyfill全局对象
 * 由@webcomponents/webcomponentsjs提供
 */
interface WebComponentsGlobal {
  ready?: boolean;
  waitFor?: (callback: () => void) => void;
}

interface Window {
  /**
   * Web Components polyfill全局对象
   * 在polyfill加载完成后设置为ready状态
   */
  WebComponents?: WebComponentsGlobal;
}
