import { FileItem } from './platform';
import { RuleConfig } from './rule';

/**
 * postMessage 通信消息类型
 */
export type MessageType =
  | 'DIALOG_READY'     // iframe 加载完成
  | 'DIALOG_OPEN'      // 打开对话框,传递文件数据
  | 'DIALOG_CLOSE'     // 关闭对话框
  | 'DIALOG_CONFIRM'   // 确认重命名操作
  | 'BADGE_UPDATE';    // 更新徽章数量

/**
 * 基础消息接口
 */
export interface BaseMessage {
  /** 消息类型 */
  type: MessageType;
  /** 唯一标识符,用于验证消息来源 */
  nonce: string;
}

/**
 * DIALOG_READY 消息
 * iframe 加载完成后发送给父页面
 */
export interface DialogReadyMessage extends BaseMessage {
  type: 'DIALOG_READY';
}

/**
 * DIALOG_OPEN 消息
 * 父页面打开对话框时发送给 iframe
 */
export interface DialogOpenMessage extends BaseMessage {
  type: 'DIALOG_OPEN';
  payload: {
    /** 选中的文件列表 */
    files: FileItem[];
  };
}

/**
 * DIALOG_CLOSE 消息
 * iframe 请求关闭对话框
 */
export interface DialogCloseMessage extends BaseMessage {
  type: 'DIALOG_CLOSE';
}

/**
 * DIALOG_CONFIRM 消息
 * 用户确认重命名操作,返回规则配置
 */
export interface DialogConfirmMessage extends BaseMessage {
  type: 'DIALOG_CONFIRM';
  payload: {
    /** 重命名规则配置 */
    ruleConfig: RuleConfig;
    /** 选中的文件列表 */
    files: FileItem[];
  };
}

/**
 * BADGE_UPDATE 消息
 * Content Script 通知 FloatingButton 更新徽章
 */
export interface BadgeUpdateMessage extends BaseMessage {
  type: 'BADGE_UPDATE';
  payload: {
    /** 选中文件数量 */
    count: number;
  };
}

/**
 * 联合消息类型
 */
export type Message =
  | DialogReadyMessage
  | DialogOpenMessage
  | DialogCloseMessage
  | DialogConfirmMessage
  | BadgeUpdateMessage;

/**
 * 消息验证器
 */
export class MessageValidator {
  /**
   * 验证消息格式是否正确
   */
  static validate(data: any): data is Message {
    if (!data || typeof data !== 'object') {
      return false;
    }

    // 验证必需字段
    if (!data.type || !data.nonce) {
      return false;
    }

    // 验证消息类型
    const validTypes: MessageType[] = [
      'DIALOG_READY',
      'DIALOG_OPEN',
      'DIALOG_CLOSE',
      'DIALOG_CONFIRM',
      'BADGE_UPDATE',
    ];

    if (!validTypes.includes(data.type)) {
      return false;
    }

    // 验证 payload (如果有)
    if (data.type === 'DIALOG_OPEN' || data.type === 'DIALOG_CONFIRM') {
      if (!data.payload || typeof data.payload !== 'object') {
        return false;
      }
    }

    return true;
  }

  /**
   * 验证 nonce 是否匹配
   */
  static validateNonce(message: Message, expectedNonce: string): boolean {
    return message.nonce === expectedNonce;
  }
}

/**
 * 消息构造器
 */
export class MessageBuilder {
  /**
   * 创建 DIALOG_READY 消息
   */
  static createDialogReady(nonce: string): DialogReadyMessage {
    return {
      type: 'DIALOG_READY',
      nonce,
    };
  }

  /**
   * 创建 DIALOG_OPEN 消息
   */
  static createDialogOpen(nonce: string, files: FileItem[]): DialogOpenMessage {
    return {
      type: 'DIALOG_OPEN',
      nonce,
      payload: { files },
    };
  }

  /**
   * 创建 DIALOG_CLOSE 消息
   */
  static createDialogClose(nonce: string): DialogCloseMessage {
    return {
      type: 'DIALOG_CLOSE',
      nonce,
    };
  }

  /**
   * 创建 DIALOG_CONFIRM 消息
   */
  static createDialogConfirm(
    nonce: string,
    ruleConfig: RuleConfig,
    files: FileItem[]
  ): DialogConfirmMessage {
    return {
      type: 'DIALOG_CONFIRM',
      nonce,
      payload: { ruleConfig, files },
    };
  }

  /**
   * 创建 BADGE_UPDATE 消息
   */
  static createBadgeUpdate(nonce: string, count: number): BadgeUpdateMessage {
    return {
      type: 'BADGE_UPDATE',
      nonce,
      payload: { count },
    };
  }
}
