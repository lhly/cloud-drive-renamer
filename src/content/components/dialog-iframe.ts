import { logger } from '../../utils/logger';
import { FileItem } from '../../types/platform';
import { RuleConfig } from '../../types/rule';
import {
  Message,
  MessageValidator,
  MessageBuilder,
  DialogConfirmMessage,
} from '../../types/message';

/**
 * Dialog iframe 容器组件
 *
 * 功能:
 * - 创建和管理 iframe 容器
 * - 处理 postMessage 通信
 * - 打开/关闭动画
 * - 遮罩背景和模糊效果
 *
 * 使用方式:
 * const dialog = new DialogIframe({
 *   onConfirm: (ruleConfig, files) => { ... },
 *   onClose: () => { ... }
 * });
 * dialog.open(files);
 */

interface DialogIframeOptions {
  /** 确认事件回调 */
  onConfirm: (ruleConfig: RuleConfig, files: FileItem[]) => void;
  /** 关闭事件回调 */
  onClose: () => void;
}

export class DialogIframe {
  private container: HTMLDivElement | null = null;
  private overlay: HTMLDivElement | null = null;
  private iframe: HTMLIFrameElement | null = null;
  private options: DialogIframeOptions;
  private nonce: string = '';
  private isOpen = false;
  private messageListener: ((e: MessageEvent) => void) | null = null;

  constructor(options: DialogIframeOptions) {
    this.options = options;
  }

  /**
   * 打开对话框
   */
  async open(files: FileItem[]): Promise<void> {
    if (this.isOpen) {
      logger.warn('Dialog is already open');
      return;
    }

    try {
      // 生成唯一 nonce
      this.nonce = this.generateNonce();

      // 创建容器
      this.createContainer();

      // 等待 iframe 加载完成
      await this.waitForIframeReady();

      // 发送文件数据
      this.sendMessage(MessageBuilder.createDialogOpen(this.nonce, files));

      // 显示对话框
      this.show();

      this.isOpen = true;
    } catch (error) {
      logger.error('Failed to open dialog:', error instanceof Error ? error : new Error(String(error)));
      this.close();
      throw error;
    }
  }

  /**
   * 关闭对话框
   */
  close(): void {
    if (!this.isOpen) return;

    // 播放关闭动画
    this.hide();

    // 延迟清理 DOM(等待动画完成)
    setTimeout(() => {
      this.cleanup();
      this.isOpen = false;
      this.options.onClose();
    }, 200);
  }

  /**
   * 创建容器元素
   */
  private createContainer(): void {
    // 创建遮罩层
    this.overlay = document.createElement('div');
    this.overlay.className = 'dialog-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.15);
      backdrop-filter: blur(4px);
      z-index: 999998;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;

    // 点击遮罩关闭
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });

    // 创建对话框容器
    this.container = document.createElement('div');
    this.container.className = 'dialog-container';
    this.container.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0.9);
      width: 90vw;
      max-width: 1200px;
      height: 80vh;
      max-height: 800px;
      z-index: 999999;
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      border-radius: 12px;
      overflow: hidden;
    `;

    // 创建 iframe
    this.iframe = document.createElement('iframe');
    this.iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
      border-radius: 12px;
      background: transparent;
    `;

    // 获取扩展内部页面 URL,并通过 URL 参数传递 nonce
    const dialogUrl = new URL(chrome.runtime.getURL('src/dialog/index.html'));
    dialogUrl.searchParams.set('nonce', this.nonce);
    this.iframe.src = dialogUrl.toString();

    // 组装 DOM
    this.container.appendChild(this.iframe);
    document.body.appendChild(this.overlay);
    document.body.appendChild(this.container);

    // 添加消息监听
    this.attachMessageListener();

    // ESC 键关闭
    this.attachKeyListener();
  }

  /**
   * 显示对话框(播放打开动画)
   */
  private show(): void {
    // 触发重排以启动动画
    requestAnimationFrame(() => {
      if (this.overlay) {
        this.overlay.style.opacity = '1';
      }
      if (this.container) {
        this.container.style.opacity = '1';
        this.container.style.transform = 'translate(-50%, -50%) scale(1)';
      }
    });
  }

  /**
   * 隐藏对话框(播放关闭动画)
   */
  private hide(): void {
    if (this.overlay) {
      this.overlay.style.opacity = '0';
    }
    if (this.container) {
      this.container.style.opacity = '0';
      this.container.style.transform = 'translate(-50%, -50%) scale(0.9)';
    }
  }

  /**
   * 清理 DOM 和事件监听
   */
  private cleanup(): void {
    // 移除消息监听
    if (this.messageListener) {
      window.removeEventListener('message', this.messageListener);
      this.messageListener = null;
    }

    // 移除 DOM
    this.overlay?.remove();
    this.container?.remove();

    this.overlay = null;
    this.container = null;
    this.iframe = null;
    this.nonce = '';
  }

  /**
   * 等待 iframe 加载完成
   */
  private waitForIframeReady(): Promise<void> {

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        logger.error('[DialogIframe] Iframe loading timeout after 5 seconds');
        logger.error('[DialogIframe] No DIALOG_READY message received');
        reject(new Error('Iframe loading timeout'));
      }, 5000);

      // 监听 DIALOG_READY 消息
      const readyHandler = (e: MessageEvent) => {
        const data = e.data;

        if (!MessageValidator.validate(data)) {
          logger.warn('[DialogIframe] Message validation failed');
          return;
        }

        if (data.type === 'DIALOG_READY' && data.nonce === this.nonce) {
          clearTimeout(timeout);
          window.removeEventListener('message', readyHandler);
          resolve();
        } else if (data.type === 'DIALOG_READY') {
          logger.warn('[DialogIframe] DIALOG_READY with wrong nonce:', {
            received: data.nonce,
            expected: this.nonce
          });
        }
      };

      window.addEventListener('message', readyHandler);

      // 发送初始 nonce
      // iframe 加载完成后会读取这个 nonce
    });
  }

  /**
   * 发送消息到 iframe
   */
  private sendMessage(message: Message): void {
    if (!this.iframe || !this.iframe.contentWindow) {
      logger.error('Iframe not ready for messaging');
      return;
    }

    // 使用扩展的 origin 而不是通配符 '*'
    const targetOrigin = new URL(chrome.runtime.getURL('/')).origin;
    this.iframe.contentWindow.postMessage(message, targetOrigin);
  }

  /**
   * 附加消息监听器
   */
  private attachMessageListener(): void {
    this.messageListener = (e: MessageEvent) => {
      const data = e.data;

      // 验证消息格式
      if (!MessageValidator.validate(data)) {
        return;
      }

      // 验证 nonce
      if (!MessageValidator.validateNonce(data, this.nonce)) {
        logger.warn('Invalid nonce in message');
        return;
      }

      // 验证来源(必须是 iframe)
      if (e.source !== this.iframe?.contentWindow) {
        logger.warn('Message from unknown source');
        return;
      }

      // 处理消息
      this.handleMessage(data);
    };

    window.addEventListener('message', this.messageListener);
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(message: Message): void {
    switch (message.type) {
      case 'DIALOG_CLOSE':
        this.close();
        break;

      case 'DIALOG_CONFIRM': {
        const confirmMsg = message as DialogConfirmMessage;
        this.options.onConfirm(
          confirmMsg.payload.ruleConfig,
          confirmMsg.payload.files
        );
        this.close();
        break;
      }

      default:
    }
  }

  /**
   * 附加键盘监听(ESC 关闭)
   */
  private attachKeyListener(): void {
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    };

    window.addEventListener('keydown', keyHandler);

    // 清理时移除监听
    const originalCleanup = this.cleanup.bind(this);
    this.cleanup = () => {
      window.removeEventListener('keydown', keyHandler);
      originalCleanup();
    };
  }

  /**
   * 生成唯一 nonce
   */
  private generateNonce(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
}
