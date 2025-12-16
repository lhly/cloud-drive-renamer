/**
 * 日志级别
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/**
 * 日志管理器
 */
class Logger {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = import.meta.env.DEV || false;
  }

  /**
   * DEBUG级别日志 - 仅在开发环境输出
   */
  debug(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      console.log(`[CDR] [${LogLevel.DEBUG}]`, message, ...args);
    }
  }

  /**
   * INFO级别日志 - 仅在开发环境输出
   */
  info(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      console.log(`[CDR] [${LogLevel.INFO}]`, message, ...args);
    }
  }

  /**
   * WARN级别日志
   */
  warn(message: string, ...args: any[]): void {
    console.warn(`[CDR] [${LogLevel.WARN}]`, message, ...args);
  }

  /**
   * ERROR级别日志
   */
  error(message: string, error?: Error, ...args: any[]): void {
    console.error(`[CDR] [${LogLevel.ERROR}]`, message, error, ...args);
  }

  /**
   * 带时间戳的日志
   */
  logWithTimestamp(_level: LogLevel, _message: string, ..._args: any[]): void {
  }
}

export const logger = new Logger();
