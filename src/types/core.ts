/**
 * 进度事件接口
 */
export interface ProgressEvent {
  /** 已完成数量 */
  completed: number;
  /** 总数量 */
  total: number;
  /** 当前处理文件名 */
  currentFile: string;
  /** 成功数量 */
  success: number;
  /** 失败数量 */
  failed: number;
  /** 当前完成的文件ID（可选） */
  fileId?: string;
  /** 当前完成的目标文件名（可选） */
  newName?: string;
  /** 当前完成任务状态（可选） */
  status?: 'success' | 'failed';
  /** 失败原因（可选） */
  error?: string;
}

/**
 * 批量执行结果
 */
export interface BatchResults {
  /** 成功的结果 */
  success: Array<{
    fileId: string;
    original: string;
    renamed: string;
    index: number;
  }>;
  /** 失败的结果 */
  failed: Array<{
    fileId: string;
    file: any;
    error: string;
    index: number;
  }>;
}

/**
 * 操作状态(用于崩溃恢复)
 */
export interface OperationState {
  /** 时间戳 */
  timestamp: number;
  /** 平台 */
  platform: string;
  /** 文件列表 */
  files: any[];
  /** 规则配置 */
  rule: any;
  /** 已完成的索引 */
  completed: number[];
  /** 失败的索引 */
  failed: number[];
}

/**
 * 任务接口(用于批量执行)
 */
export interface Task {
  /** 文件信息 */
  file: any;
  /** 新文件名 */
  newName: string;
  /** 索引 */
  index: number;
}
