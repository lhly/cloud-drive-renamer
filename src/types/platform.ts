/**
 * 云盘平台类型
 */
export type PlatformName = 'quark' | 'aliyun' | 'baidu';

/**
 * 文件项接口
 */
export interface FileItem {
  /** 文件唯一标识符 */
  id: string;
  /** 文件名(含扩展名) */
  name: string;
  /** 文件扩展名(含点,如 .mp4) */
  ext: string;
  /** 父目录ID */
  parentId: string;
  /** 文件大小(字节) */
  size: number;
  /** 修改时间戳(毫秒) */
  mtime: number;
}

/**
 * 重命名结果接口
 */
export interface RenameResult {
  /** 是否成功 */
  success: boolean;
  /** 新文件名 */
  newName?: string;
  /** 错误信息 */
  error?: Error;
  /** 是否跳过 */
  skipped?: boolean;
  /** 跳过原因 */
  reason?: string;
}

/**
 * 平台适配器接口
 * 所有云盘平台必须实现此接口
 */
export interface PlatformAdapter {
  /** 平台名称 */
  readonly platform: PlatformName;

  /**
   * 获取当前选中的文件列表
   * @returns 选中的文件数组
   */
  getSelectedFiles(): Promise<FileItem[]>;

  /**
   * 重命名单个文件
   * @param fileId 文件ID
   * @param newName 新文件名
   * @returns 重命名结果
   */
  renameFile(fileId: string, newName: string): Promise<RenameResult>;

  /**
   * 检查文件名是否冲突
   * @param fileName 文件名
   * @param parentId 父目录ID
   * @returns 是否存在同名文件
   */
  checkNameConflict(fileName: string, parentId: string): Promise<boolean>;

  /**
   * 获取文件信息
   * @param fileId 文件ID
   * @returns 文件详细信息
   */
  getFileInfo(fileId: string): Promise<FileItem>;

  /**
   * 获取平台配置
   * @returns 平台特定配置
   */
  getConfig(): PlatformConfig;
}

/**
 * 平台配置接口
 */
export interface PlatformConfig {
  /** 平台名称 */
  platform: PlatformName;
  /** API请求间隔(毫秒) */
  requestInterval: number;
  /** 最大重试次数 */
  maxRetries: number;
  /** 请求超时时间(毫秒) */
  timeout?: number;
}
