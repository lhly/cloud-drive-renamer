import type { PlatformName } from './platform';

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
  module?: string;
  source?: string;
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
 * 失败文件明细
 */
export interface DiagnosticFailureItem {
  fileId: string;
  originalName: string;
  targetName: string;
  errorMessage: string;
  attempt: number;
}

/**
 * 一次导出的任务摘要
 */
export interface DiagnosticSummary {
  platform: PlatformName;
  total: number;
  success: number;
  failed: number;
  retried: number;
  startedAt: number;
  finishedAt: number;
}

/**
 * 最近一次失败的诊断快照
 */
export interface LastFailureDiagnosticSnapshot {
  failure: DiagnosticFailureEntry;
  summary: DiagnosticSummary;
  failures: DiagnosticFailureItem[];
  recentLogs?: DiagnosticLogEntry[];
}

/**
 * 导出诊断载荷
 */
export interface DiagnosticExportPayload {
  exportedAt: number;
  lastFailure: LastFailureDiagnosticSnapshot | null;
  logs: DiagnosticLogEntry[];
}

/**
 * 诊断提示状态
 */
export type DiagnosticPromptState = 'hidden' | 'ready' | 'exporting' | 'exported' | 'error';

export const DIAGNOSTIC_STORAGE_KEYS = {
  RECENT_LOGS: 'diagnostic_recent_logs',
  LAST_FAILURE: 'diagnostic_last_failure',
} as const;
