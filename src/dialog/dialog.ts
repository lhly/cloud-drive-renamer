/**
 * Dialog 页面脚本入口
 *
 * 功能:
 * - 加载和注册 Lit Web Components
 * - 处理父页面通信(postMessage)
 * - 渲染 rename-dialog 组件
 * - 处理用户交互事件
 */

import { logger } from '../utils/logger';
import { FileItem } from '../types/platform';
import { RuleConfig } from '../types/rule';
import {
  Message,
  MessageValidator,
  MessageBuilder,
  DialogOpenMessage,
} from '../types/message';

// 动态导入 Lit Web Components
import { RenameDialog } from '../content/components/rename-dialog';
import { RenamePreview } from '../content/components/rename-preview';

/**
 * 初始化对话框页面
 */
async function init() {
  try {

    // 检查 customElements API 是否可用
    if (typeof customElements === 'undefined') {
      throw new Error('customElements API is not available in this context');
    }

    // 注册 Web Components
    if (!customElements.get('rename-dialog')) {
      customElements.define('rename-dialog', RenameDialog);
    }

    if (!customElements.get('rename-preview')) {
      customElements.define('rename-preview', RenamePreview);
    }

    // 获取对话框元素
    const dialogElement = document.getElementById(
      'rename-dialog'
    ) as any;

    if (!dialogElement) {
      throw new Error('rename-dialog element not found');
    }

    // 设置对话框为打开状态
    dialogElement.open = true;

    // 设置通信处理器
    setupCommunication(dialogElement);

    // 通知父页面已准备就绪
    sendReadyMessage();

  } catch (error) {
    logger.error('[Dialog] Failed to initialize dialog page:', error instanceof Error ? error : new Error(String(error)));

    // 如果初始化失败，通知父页面关闭对话框
    const nonce = getNonceFromUrl();
    if (nonce) {
      sendMessage(MessageBuilder.createDialogClose(nonce));
    }
  }
}

/**
 * 设置父子通信
 */
function setupCommunication(dialogElement: any) {
  // 从 URL 获取 nonce
  const currentNonce = getNonceFromUrl() || '';

  // 监听父页面消息
  window.addEventListener('message', (e: MessageEvent) => {
    const data = e.data;

    // 验证消息格式
    if (!MessageValidator.validate(data)) {
      return;
    }

    // 验证来源(必须是父窗口)
    if (e.source !== window.parent) {
      logger.warn('Message from unknown source');
      return;
    }

    // 验证 nonce
    if (!MessageValidator.validateNonce(data, currentNonce)) {
      logger.warn('Invalid nonce in message');
      return;
    }

    // 处理消息
    handleParentMessage(data, dialogElement);
  });

  // 监听对话框关闭事件
  dialogElement.addEventListener('dialog-close', () => {
    sendMessage(MessageBuilder.createDialogClose(currentNonce));
  });

  // 监听对话框确认事件
  dialogElement.addEventListener('dialog-confirm', (e: CustomEvent) => {

    const ruleConfig: RuleConfig = e.detail.ruleConfig;
    const files: FileItem[] = dialogElement.files || [];

    sendMessage(
      MessageBuilder.createDialogConfirm(currentNonce, ruleConfig, files)
    );
  });
}

/**
 * 处理父页面消息
 */
function handleParentMessage(message: Message, dialogElement: any) {
  switch (message.type) {
    case 'DIALOG_OPEN':
      const openMsg = message as DialogOpenMessage;
      dialogElement.files = openMsg.payload.files;
      dialogElement.open = true;
      break;

    default:
  }
}

/**
 * 发送消息到父页面
 */
function sendMessage(message: Message) {
  if (!window.parent) {
    logger.error('[Dialog] Parent window not available');
    return;
  }

  // 使用通配符 '*' 因为 iframe 的 parent 是主页面(https://pan.quark.cn)而非扩展上下文
  // nonce 验证确保了消息安全性
  const targetOrigin = '*';

  window.parent.postMessage(message, targetOrigin);
}

/**
 * 从 URL 参数获取 nonce
 */
function getNonceFromUrl(): string | null {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('nonce');
  } catch (error) {
    logger.error('Failed to parse URL parameters:', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * 发送准备就绪消息
 */
function sendReadyMessage() {
  // 从 URL 参数获取 nonce
  const nonce = getNonceFromUrl();


  if (!nonce) {
    logger.error('[Dialog] Nonce not found in URL parameters');
    return;
  }


  sendMessage(MessageBuilder.createDialogReady(nonce));
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
