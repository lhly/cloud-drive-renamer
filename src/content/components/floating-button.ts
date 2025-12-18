import { logger } from '../../utils/logger';
import { I18nService } from '../../utils/i18n';

/**
 * 悬浮按钮组件
 *
 * 功能:
 * - 固定位置显示(右侧中间)
 * - 可拖拽调整位置
 * - 位置记忆(通过 chrome.storage.local)
 * - 实时徽章更新
 * - 鼠标悬停动画
 *
 * 使用方式:
 * const button = new FloatingButton({
 *   onClick: () => { ... },
 *   onBadgeUpdate: (count) => { ... }
 * });
 * button.mount(document.body);
 */

/**
 * 悬浮按钮颜色主题配置
 * 方案A: 品牌协调型 - 与图标色调完美匹配的灰蓝色系
 */
const BUTTON_THEME = {
  // 主背景渐变色（灰蓝色系，匹配图标色调）
  gradient: 'linear-gradient(135deg, #5A6C7D 0%, #7B99B4 100%)',
  // 默认阴影（基于起始色的半透明效果）
  shadowDefault: '0 4px 16px rgba(90, 108, 125, 0.35)',
  // 悬停阴影（增强效果）
  shadowHover: '0 6px 24px rgba(90, 108, 125, 0.5)',
  // 阴影颜色RGB值（用于动态计算）
  shadowRGB: '90, 108, 125',
} as const;

interface FloatingButtonOptions {
  /** 点击事件回调 */
  onClick: () => void;
  /** 徽章更新回调 */
  onBadgeUpdate?: (count: number) => void;
}

interface ButtonPosition {
  top: number;
  left: number;
}

const STORAGE_KEY = 'floatingButton_position';
const DEFAULT_POSITION: ButtonPosition = {
  top: 50, // 50% from top
  left: 90, // 90% from left (positioned near right edge)
};

export class FloatingButton {
  private container: HTMLDivElement | null = null;
  private button: HTMLDivElement | null = null;
  private badge: HTMLSpanElement | null = null;
  private options: FloatingButtonOptions;
  private position: ButtonPosition = DEFAULT_POSITION;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private buttonCount = 0;
  // 存储事件监听器引用以便清理
  private mouseMoveHandler: ((e: MouseEvent) => void) | null = null;
  private mouseUpHandler: (() => void) | null = null;
  // Tooltip元素
  private tooltip: HTMLDivElement | null = null;
  // Icon元素（用于动态更新alt属性）
  private iconImg: HTMLImageElement | null = null;
  // 用于区分点击和拖拽
  private mouseDownTime = 0;
  private mouseDownX = 0;
  private mouseDownY = 0;
  // 可见性状态
  private isVisible = true;

  constructor(options: FloatingButtonOptions) {
    this.options = options;
    this.loadPosition();
  }

  /**
   * 挂载到 DOM
   */
  async mount(parent: HTMLElement): Promise<void> {
    try {
      // 检查Shadow DOM支持
      if (!('attachShadow' in document.createElement('div'))) {
        logger.warn('Shadow DOM not supported, using fallback mount strategy');
        // 降级方案：直接挂载容器
        this.container = this.createContainer();
        this.container.style.zIndex = '2147483647';
        parent.appendChild(this.container);
        await this.loadPosition();
        this.applyPosition();
        logger.info('FloatingButton mounted successfully (fallback mode)');
        return;
      }

      // 创建Shadow DOM宿主
      const host = document.createElement('div');
      host.id = 'cloud-drive-renamer-shadow-host';
      host.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 2147483647;
        pointer-events: none;
      `;

      // 创建Shadow Root
      const shadowRoot = host.attachShadow({ mode: 'open' });

      // 创建容器并挂载到Shadow DOM
      this.container = this.createContainer();
      shadowRoot.appendChild(this.container);

      // 将宿主挂载到页面
      parent.appendChild(host);

      // 应用保存的位置
      await this.loadPosition();
      this.applyPosition();

      logger.info('FloatingButton mounted successfully with Shadow DOM');
    } catch (error) {
      logger.error('Failed to mount FloatingButton:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * 卸载组件
   */
  unmount(): void {
    // 先移除document级别的事件监听器
    if (this.mouseMoveHandler) {
      document.removeEventListener('mousemove', this.mouseMoveHandler);
      this.mouseMoveHandler = null;
    }
    if (this.mouseUpHandler) {
      document.removeEventListener('mouseup', this.mouseUpHandler);
      this.mouseUpHandler = null;
    }

    // 然后清理DOM元素
    if (this.container) {
      // 找到Shadow host并移除
      const shadowHost = this.container.getRootNode();
      if (shadowHost instanceof ShadowRoot) {
        shadowHost.host.remove();
      } else {
        this.container.remove();
      }
      this.container = null;
      this.button = null;
      this.badge = null;
    }
  }

  /**
   * 更新徽章数量
   */
  updateBadge(count: number): void {
    this.buttonCount = count;

    // 添加 INFO 日志便于调试

    if (!this.badge || !this.button) {
      logger.warn('[FloatingButton] updateBadge: badge or button is null');
      return;
    }

    if (count > 0) {
      this.badge.textContent = String(count);
      this.badge.style.display = 'flex';
      this.button.style.opacity = '1';
      this.button.style.cursor = 'move';  // 改为move，强调可拖动
      logger.info(`[FloatingButton] Button enabled with ${count} files`);
    } else {
      this.badge.style.display = 'none';
      this.button.style.opacity = '0.5';
      // 🔧 关键优化：不设置pointer-events: none，保持拖动始终可用
      // 点击限制由事件处理器中的buttonCount检查实现
      this.button.style.cursor = 'move';  // 置灰状态也可以拖动
    }

    // 触发回调
    this.options.onBadgeUpdate?.(count);
  }

  /**
   * 创建容器元素
   */
  private createContainer(): HTMLDivElement {
    const container = document.createElement('div');
    container.id = 'cloud-drive-renamer-floating-button';
    container.style.cssText = `
      position: fixed;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      pointer-events: auto;
    `;

    // 创建并添加样式到Shadow DOM
    const style = document.createElement('style');
    style.textContent = this.getStyles();
    container.appendChild(style);

    // 创建按钮
    this.button = this.createButton();
    container.appendChild(this.button);

    // 创建徽章
    this.badge = this.createBadge();
    this.button.appendChild(this.badge);

    // 先赋值 this.container，确保 attachEventListeners 可以访问
    this.container = container;

    // 添加事件监听
    this.attachEventListeners();

    return container;
  }

  /**
   * 获取Shadow DOM内的样式
   */
  private getStyles(): string {
    return `
      @keyframes badgePop {
        0% { transform: scale(0); }
        50% { transform: scale(1.2); }
        100% { transform: scale(1); }
      }

      @keyframes tooltipFadeIn {
        from {
          opacity: 0;
          transform: translateX(-50%) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) scale(1);
        }
      }

      .tooltip {
        position: absolute;
        bottom: calc(100% + 12px);
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.85);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        white-space: nowrap;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s ease;
        animation: tooltipFadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 1000;
      }

      .tooltip::after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 6px solid transparent;
        border-top-color: rgba(0, 0, 0, 0.85);
      }

      .tooltip.visible {
        opacity: 1;
      }
    `;
  }

  /**
   * 创建按钮元素
   */
  private createButton(): HTMLDivElement {
    const button = document.createElement('div');
    button.className = 'floating-button';
    button.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      background: ${BUTTON_THEME.gradient};
      color: white;
      border-radius: 50%;
      box-shadow: ${BUTTON_THEME.shadowDefault};
      cursor: move;
      user-select: none;
      position: relative;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      opacity: 0.5;
    `;

    // 创建图标容器
    const iconContainer = document.createElement('div');
    iconContainer.style.cssText = `
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // 使用项目图标
    const icon = document.createElement('img');
    icon.src = chrome.runtime.getURL('icons/icon48.png');
    icon.style.cssText = `
      width: 28px;
      height: 28px;
      object-fit: contain;
    `;
    icon.alt = I18nService.t('floating_button_alt');

    // 保存引用以便后续更新 alt 属性
    this.iconImg = icon;

    // 添加错误处理：如果图标加载失败，使用emoji作为后备
    icon.onerror = () => {
      logger.warn('[FloatingButton] Failed to load icon, using emoji fallback');
      // 替换为emoji
      const emojiSpan = document.createElement('span');
      emojiSpan.textContent = '📁';
      emojiSpan.style.cssText = 'font-size: 28px;';
      iconContainer.replaceChild(emojiSpan, icon);
    };

    iconContainer.appendChild(icon);
    button.appendChild(iconContainer);

    // 创建tooltip
    this.tooltip = this.createTooltip();
    button.appendChild(this.tooltip);

    // 鼠标悬停效果
    button.addEventListener('mouseenter', () => {
      // 🔧 修复：拖动时不显示tooltip和悬停效果
      if (!this.isDragging && this.tooltip) {
        // 根据按钮状态动态设置 tooltip 内容
        if (this.buttonCount > 0) {
          // 有文件选中：显示功能提示
          this.tooltip.textContent = I18nService.t('floating_button_tooltip');
          button.style.transform = 'scale(1.1)';
          button.style.boxShadow = BUTTON_THEME.shadowHover;
        } else {
          // 未选中文件：显示激活提示
          this.tooltip.textContent = I18nService.t('floating_button_tooltip_activate');
        }
        this.tooltip.classList.add('visible');
      }
    });

    button.addEventListener('mouseleave', () => {
      if (!this.isDragging) {
        button.style.transform = 'scale(1)';
        button.style.boxShadow = BUTTON_THEME.shadowDefault;
        // 隐藏tooltip
        if (this.tooltip) {
          this.tooltip.classList.remove('visible');
        }
      }
    });

    return button;
  }

  /**
   * 创建Tooltip元素
   */
  private createTooltip(): HTMLDivElement {
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    // 初始文本为空，由 mouseenter 事件动态设置
    return tooltip;
  }

  /**
   * 创建徽章元素
   */
  private createBadge(): HTMLSpanElement {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.style.cssText = `
      position: absolute;
      top: -6px;
      right: -6px;
      min-width: 20px;
      height: 20px;
      padding: 0 6px;
      background: #ff4757;
      color: white;
      border-radius: 10px;
      font-size: 12px;
      font-weight: bold;
      display: none;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      animation: badgePop 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    `;

    return badge;
  }

  /**
   * 附加事件监听器
   */
  private attachEventListeners(): void {
    if (!this.button || !this.container) {
      logger.warn('[FloatingButton] attachEventListeners: button or container is null!');
      return;
    }

    logger.info('[FloatingButton] Attaching event listeners to button');

    // 点击事件 - 使用捕获阶段监听,防止被网页脚本阻止
    this.button.addEventListener('click', (e) => {
      // 计算移动距离和时间
      const moveDistance = Math.sqrt(
        Math.pow(e.clientX - this.mouseDownX, 2) +
        Math.pow(e.clientY - this.mouseDownY, 2)
      );
      const holdTime = Date.now() - this.mouseDownTime;

      // 添加 INFO 级别日志
      logger.info('[FloatingButton] Click event detected:', {
        moveDistance,
        holdTime,
        isDragging: this.isDragging,
        buttonCount: this.buttonCount,
        willTriggerOnClick: moveDistance < 5 && holdTime < 300 && !this.isDragging && this.buttonCount > 0,
        eventPhase: e.eventPhase,
        isTrusted: e.isTrusted
      });

      // 只有在移动距离很小且按住时间短的情况下才认为是点击
      // 否则认为是拖拽操作
      if (moveDistance < 5 && holdTime < 300 && !this.isDragging && this.buttonCount > 0) {
        // 立即阻止事件传播,防止被网页脚本干扰
        e.stopPropagation();
        e.preventDefault();

        logger.info('[FloatingButton] Triggering onClick callback');
        this.options.onClick();
      } else {
        logger.info('[FloatingButton] onClick blocked:', {
          reason: moveDistance >= 5 ? 'moved too much (dragging)' :
                  holdTime >= 300 ? 'held too long (dragging)' :
                  this.isDragging ? 'currently dragging' :
                  'buttonCount is 0'
        });
      }
    }, { capture: true }); // ← 在捕获阶段监听

    logger.info('[FloatingButton] Click event listener attached successfully');

    // 拖拽事件 - 也使用捕获阶段,确保拖拽不受干扰
    this.button.addEventListener('mousedown', (e) => {
      // 记录按下的时间和位置
      this.mouseDownTime = Date.now();
      this.mouseDownX = e.clientX;
      this.mouseDownY = e.clientY;

      // 整个按钮都可以拖拽
      e.stopPropagation();
      e.preventDefault();
      this.startDrag(e);
    }, { capture: true });

    // 拖拽事件 - 保存引用以便清理
    this.mouseMoveHandler = (e: MouseEvent) => {
      if (this.isDragging) {
        this.onDrag(e);
      }
    };

    this.mouseUpHandler = () => {
      if (this.isDragging) {
        this.endDrag();
      }
    };

    document.addEventListener('mousemove', this.mouseMoveHandler);
    document.addEventListener('mouseup', this.mouseUpHandler);

    // 双击恢复默认位置
    this.button.addEventListener('dblclick', () => {
      this.resetPosition();
    });

    logger.info('[FloatingButton] All event listeners attached successfully');
  }

  /**
   * 开始拖拽
   */
  private startDrag(e: MouseEvent): void {
    this.isDragging = true;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;

    if (this.button) {
      this.button.style.cursor = 'grabbing';
      // 隐藏tooltip
      if (this.tooltip) {
        this.tooltip.classList.remove('visible');
      }
    }

    // 🔧 关键修复：禁用容器的transition，避免拖拽时的延迟动画
    if (this.container) {
      this.container.style.transition = 'none';
    }

  }

  /**
   * 拖拽过程中
   */
  private onDrag(e: MouseEvent): void {
    if (!this.isDragging || !this.container) return;

    const deltaX = e.clientX - this.dragStartX;
    const deltaY = e.clientY - this.dragStartY;

    // 计算新位置(相对于视口百分比)
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const currentLeft = (this.position.left / 100) * viewportWidth;
    const currentTop = (this.position.top / 100) * viewportHeight;

    const newLeft = currentLeft + deltaX;
    const newTop = currentTop + deltaY;

    // 限制在视口范围内
    const buttonWidth = this.button?.offsetWidth || 0;
    const buttonHeight = this.button?.offsetHeight || 0;

    const minLeft = 0;
    const maxLeft = viewportWidth - buttonWidth;
    const minTop = 0;
    const maxTop = viewportHeight - buttonHeight;

    const clampedLeft = Math.max(minLeft, Math.min(maxLeft, newLeft));
    const clampedTop = Math.max(minTop, Math.min(maxTop, newTop));

    // 转换为百分比
    this.position.left = (clampedLeft / viewportWidth) * 100;
    this.position.top = (clampedTop / viewportHeight) * 100;

    // 应用新位置
    this.applyPosition();

    // 更新拖拽起始点
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
  }

  /**
   * 结束拖拽
   */
  private endDrag(): void {
    this.isDragging = false;

    if (this.button) {
      this.button.style.cursor = 'move';
    }

    // 🔧 恢复容器的transition，用于平滑的悬停动画
    if (this.container) {
      this.container.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    }

    // 保存位置
    this.savePosition();

  }

  /**
   * 重置到默认位置
   */
  private resetPosition(): void {
    this.position = { ...DEFAULT_POSITION };
    this.applyPosition();
    this.savePosition();
    logger.info('Position reset to default');
  }

  /**
   * 应用位置
   */
  private applyPosition(): void {
    if (!this.container) return;

    this.container.style.top = `${this.position.top}%`;
    this.container.style.left = `${this.position.left}%`;
    this.container.style.transform = 'none';
  }

  /**
   * 加载保存的位置
   */
  private async loadPosition(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      if (result[STORAGE_KEY]) {
        this.position = result[STORAGE_KEY];
      } else {
        this.position = { ...DEFAULT_POSITION };
      }
    } catch (error) {
      logger.error('Failed to load position:', error instanceof Error ? error : new Error(String(error)));
      this.position = { ...DEFAULT_POSITION };
    }
  }

  /**
   * 显示悬浮按钮
   */
  show(): void {
    if (!this.container) {
      logger.warn('[FloatingButton] show: container is null');
      return;
    }
    this.isVisible = true;
    this.container.style.display = 'block';
    logger.info('[FloatingButton] Button shown');
  }

  /**
   * 隐藏悬浮按钮
   */
  hide(): void {
    if (!this.container) {
      logger.warn('[FloatingButton] hide: container is null');
      return;
    }
    this.isVisible = false;
    this.container.style.display = 'none';
    logger.info('[FloatingButton] Button hidden');
  }

  /**
   * 获取当前可见性状态
   */
  getVisibility(): boolean {
    return this.isVisible;
  }

  /**
   * 保存位置
   */
  private async savePosition(): Promise<void> {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: this.position });
    } catch (error) {
      logger.error('Failed to save position:', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Update tooltip text based on current language and button state
   * Called when language changes
   */
  updateLanguage(): void {
    if (!this.tooltip) return;

    if (this.buttonCount > 0) {
      this.tooltip.textContent = I18nService.t('floating_button_tooltip');
    } else {
      this.tooltip.textContent = I18nService.t('floating_button_tooltip_activate');
    }

    // 同时更新 icon 的 alt 属性（无障碍支持）
    if (this.iconImg) {
      this.iconImg.alt = I18nService.t('floating_button_alt');
    }

    logger.info('[FloatingButton] Language updated, tooltip and icon.alt refreshed');
  }
}
