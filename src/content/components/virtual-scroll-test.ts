import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { virtualize } from '@lit-labs/virtualizer/virtualize.js';

/**
 * Virtual Scrolling性能测试组件
 */
@customElement('virtual-scroll-test')
export class VirtualScrollTest extends LitElement {
  static styles = css`
    :host {
      display: block;
      height: 500px;
      border: 1px solid #ddd;
      border-radius: 8px;
      overflow: hidden;
    }

    .header {
      padding: 16px;
      background: #f5f5f5;
      border-bottom: 1px solid #ddd;
    }

    .controls {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
    }

    button {
      padding: 6px 12px;
      background: #1890ff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }

    button:hover {
      background: #40a9ff;
    }

    .stats {
      font-size: 14px;
      color: #666;
    }

    .list-container {
      height: calc(100% - 80px);
      overflow-y: auto;
    }

    .item {
      padding: 12px 16px;
      border-bottom: 1px solid #eee;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .item:hover {
      background: #f9f9f9;
    }

    .item-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .item-size {
      margin-left: 16px;
      color: #999;
      font-size: 12px;
    }
  `;

  @state()
  private items: Array<{ id: number; name: string; size: number }> = [];

  @state()
  private itemCount = 0;

  @state()
  private useVirtualScroll = false;

  @state()
  private renderTime = 0;

  render() {
    return html`
      <div class="header">
        <div class="controls">
          <button @click=${() => this.generateItems(100)}>100 items</button>
          <button @click=${() => this.generateItems(500)}>500 items</button>
          <button @click=${() => this.generateItems(1000)}>1000 items</button>
          <button @click=${() => this.toggleVirtualScroll()}>
            ${this.useVirtualScroll ? '禁用' : '启用'}虚拟滚动
          </button>
        </div>
        <div class="stats">
          ${this.itemCount} items | 渲染时间: ${this.renderTime}ms | 虚拟滚动:
          ${this.useVirtualScroll ? '开' : '关'}
        </div>
      </div>
      <div class="list-container">${this.renderList()}</div>
    `;
  }

  private renderList() {
    if (this.items.length === 0) {
      return html`<div style="padding: 16px; text-align: center; color: #999;">
        点击按钮生成测试数据
      </div>`;
    }

    if (this.useVirtualScroll) {
      return virtualize({
        items: this.items,
        renderItem: item => this.renderItem(item),
      });
    }

    return html`${this.items.map(item => this.renderItem(item))}`;
  }

  private renderItem(item: { id: number; name: string; size: number }) {
    return html`
      <div class="item">
        <span class="item-name">${item.name}</span>
        <span class="item-size">${this.formatSize(item.size)}</span>
      </div>
    `;
  }

  private generateItems(count: number) {
    const startTime = performance.now();

    this.items = Array.from({ length: count }, (_, i) => ({
      id: i,
      name: `文件_${String(i + 1).padStart(4, '0')}.mp4`,
      size: Math.floor(Math.random() * 1000000000) + 1000000,
    }));

    this.itemCount = count;

    // 启用虚拟滚动如果项目数>100
    this.useVirtualScroll = count > 100;

    // 测量渲染时间
    requestAnimationFrame(() => {
      this.renderTime = Math.round(performance.now() - startTime);
    });
  }

  private toggleVirtualScroll() {
    this.useVirtualScroll = !this.useVirtualScroll;
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'virtual-scroll-test': VirtualScrollTest;
  }
}
