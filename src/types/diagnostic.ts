/**
 * 诊断日志级别
 */
export type DiagnosticLogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

/**
 * 单条诊断日志
 */
export interface DiagnosticLogEntry {
  id: string;
  level: DiagnosticLogLevel;
  message: string;
  timestamp?: number;
  context?: Record<string, unknown>;
}

/**
 * 单次失败记录
 */
export interface DiagnosticFailureEntry {
  id: string;
  occurredAt: number;
  reason: string;
  message?: string;
}

/**
 * 最近一次失败的诊断快照
 */
export interface LastFailureDiagnosticSnapshot {
  failure: DiagnosticFailureEntry;
  recentLogs: DiagnosticLogEntry[];
}

/**
 * 导出诊断载荷
 */
export interface DiagnosticExportPayload {
  exportedAt: number;
  lastFailure: LastFailureDiagnosticSnapshot | null;
}

/**
 * 诊断提示状态
 */
export interface DiagnosticPromptState {
  shouldPrompt: boolean;
  lastPromptedAt?: number;
}

export const DIAGNOSTIC_STORAGE_KEYS = {
  RECENT_LOGS: 'diagnostic_recent_logs',
  LAST_FAILURE: 'diagnostic_last_failure',
} as const;
