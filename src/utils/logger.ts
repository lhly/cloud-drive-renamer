import { type DiagnosticLogEntry } from '../types/diagnostic';

/**
 * 日志级别
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

type LoggerDiagnosticTransport = (entry: DiagnosticLogEntry) => void | Promise<void>;

interface LoggerDiagnosticConfig {
  source: string;
  transport: LoggerDiagnosticTransport;
}

const MODULE_PREFIX_RE = /^\[([^\]]+)\]\s*/;

let diagnosticConfig: LoggerDiagnosticConfig | null = null;

function createDiagnosticEntry(
  level: LogLevel,
  source: string,
  rawMessage: string,
  context?: Record<string, unknown>
): DiagnosticLogEntry {
  const moduleMatch = rawMessage.match(MODULE_PREFIX_RE);
  const module = moduleMatch?.[1];
  const message = moduleMatch ? rawMessage.slice(moduleMatch[0].length) : rawMessage;

  return {
    id: `diag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    level,
    module,
    source,
    message,
    timestamp: Date.now(),
    context,
  };
}

function emitDiagnostic(entry: DiagnosticLogEntry): void {
  if (!diagnosticConfig) {
    return;
  }

  try {
    const result = diagnosticConfig.transport(entry);
    if (result && typeof (result as Promise<void>).catch === 'function') {
      void (result as Promise<void>).catch(() => undefined);
    }
  } catch {
    // 诊断上报失败不能影响主流程
  }
}

export function configureLoggerDiagnostics(config: LoggerDiagnosticConfig | null): void {
  diagnosticConfig = config;
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
    emitDiagnostic(
      createDiagnosticEntry(LogLevel.DEBUG, diagnosticConfig?.source ?? 'unknown', message, {
        args,
      })
    );

    if (this.isDevelopment) {
      console.log(`[CDR] [${LogLevel.DEBUG}]`, message, ...args);
    }
  }

  /**
   * INFO级别日志 - 仅在开发环境输出
   *
   * 特殊规则：以 [DIAG- 开头的诊断日志总是输出（不受开发模式限制）
   */
  info(message: string, ...args: any[]): void {
    emitDiagnostic(
      createDiagnosticEntry(LogLevel.INFO, diagnosticConfig?.source ?? 'unknown', message, {
        args,
      })
    );

    // 诊断日志总是输出，方便生产环境调试
    if (message.startsWith('[DIAG-')) {
      console.log(`[CDR] [${LogLevel.INFO}]`, message, ...args);
      return;
    }

    if (this.isDevelopment) {
      console.log(`[CDR] [${LogLevel.INFO}]`, message, ...args);
    }
  }

  /**
   * WARN级别日志
   */
  warn(message: string, ...args: any[]): void {
    emitDiagnostic(
      createDiagnosticEntry(LogLevel.WARN, diagnosticConfig?.source ?? 'unknown', message, {
        args,
      })
    );

    console.warn(`[CDR] [${LogLevel.WARN}]`, message, ...args);
  }

  /**
   * ERROR级别日志
   */
  error(message: string, error?: Error, ...args: any[]): void {
    emitDiagnostic(
      createDiagnosticEntry(LogLevel.ERROR, diagnosticConfig?.source ?? 'unknown', message, {
        errorName: error?.name,
        errorMessage: error?.message,
        errorStack: error?.stack,
        args,
      })
    );

    console.error(`[CDR] [${LogLevel.ERROR}]`, message, error, ...args);
  }

  /**
   * 带时间戳的日志
   */
  logWithTimestamp(_level: LogLevel, _message: string, ..._args: any[]): void {
  }
}

export const logger = new Logger();
