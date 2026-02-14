import {
  PlatformAdapter,
  PlatformName,
  FileItem,
  RenameResult,
  PlatformConfig,
} from '../../types/platform';

/**
 * 平台适配器抽象基类
 * 所有具体平台适配器必须继承此类
 */
export abstract class BasePlatformAdapter implements PlatformAdapter {
  abstract readonly platform: PlatformName;

  protected config: PlatformConfig;

  constructor(config: Partial<PlatformConfig>) {
    this.config = {
      platform: 'quark',
      requestInterval: 800,
      maxConcurrent: 3,
      maxRetries: 3,
      timeout: 30000,
      ...config,
    };
  }

  /**
   * 获取选中的文件列表
   * 子类必须实现
   */
  abstract getSelectedFiles(): Promise<FileItem[]>;

  /**
   * 获取当前目录的所有文件（通过API）
   * 此方法绕过DOM解析，直接从平台API获取完整文件列表
   * 用于解决虚拟滚动导致的文件丢失问题
   *
   * @param parentId 父目录ID（可选，默认当前目录）
   * @returns 完整的文件列表
   * @throws {Error} 当API请求失败时
   */
  abstract getAllFiles(parentId?: string): Promise<FileItem[]>;

  /**
   * 重命名文件
   * 子类必须实现
   */
  abstract renameFile(fileId: string, newName: string): Promise<RenameResult>;

  /**
   * 检查文件名冲突
   * 子类必须实现
   */
  abstract checkNameConflict(fileName: string, parentId: string): Promise<boolean>;

  /**
   * 获取文件信息
   * 子类必须实现
   */
  abstract getFileInfo(fileId: string): Promise<FileItem>;

  /**
   * 获取平台配置
   */
  getConfig(): PlatformConfig {
    return this.config;
  }

  /**
   * 解析文件扩展名
   * @param fileName 文件名
   * @returns 扩展名(含点)
   */
  protected extractExtension(fileName: string): string {
    const lastDot = fileName.lastIndexOf('.');
    // 没有点、以点结尾、或者只有开头一个点（隐藏文件无扩展名）
    if (lastDot === -1 || lastDot === fileName.length - 1 || lastDot === 0) {
      return '';
    }
    return fileName.substring(lastDot);
  }

  /**
   * 延迟执行
   * @param ms 延迟毫秒数
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 带超时的Fetch请求
   * @param url 请求URL
   * @param options Fetch选项
   * @returns Response对象
   */
  protected async fetchWithTimeout(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const timeout = this.config.timeout || 30000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
}
