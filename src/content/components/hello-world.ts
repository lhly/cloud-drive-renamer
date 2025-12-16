import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

/**
 * Hello World示例组件
 * 用于学习Lit框架基础
 */
@customElement('hello-world')
export class HelloWorld extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 16px;
      border: 1px solid #ddd;
      border-radius: 8px;
    }

    .container {
      text-align: center;
    }

    h1 {
      color: #1890ff;
      margin-bottom: 12px;
    }

    button {
      padding: 8px 16px;
      background: #1890ff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    button:hover {
      background: #40a9ff;
    }

    .count {
      font-size: 24px;
      font-weight: bold;
      margin: 16px 0;
    }
  `;

  @property({ type: String })
  message = 'Hello, Lit!';

  @state()
  private count = 0;

  render() {
    return html`
      <div class="container">
        <h1>${this.message}</h1>
        <div class="count">计数: ${this.count}</div>
        <button @click=${this.increment}>增加</button>
        <button @click=${this.decrement}>减少</button>
        <button @click=${this.reset}>重置</button>
      </div>
    `;
  }

  private increment() {
    this.count++;
  }

  private decrement() {
    this.count--;
  }

  private reset() {
    this.count = 0;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hello-world': HelloWorld;
  }
}
