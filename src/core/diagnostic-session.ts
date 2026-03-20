import type {
  DiagnosticFailureItem,
  DiagnosticSummary,
  LastFailureDiagnosticSnapshot,
} from '../types/diagnostic';
import type { PlatformName } from '../types/platform';

export interface DiagnosticExecutionItem {
  fileId: string;
  originalName: string;
  targetName: string;
  done?: boolean;
  error?: string;
}

interface BuildLastFailureDiagnosticSnapshotInput {
  platform: PlatformName;
  startedAt: number;
  finishedAt: number;
  retried: number;
  items: DiagnosticExecutionItem[];
}

interface BuildDiagnosticFeedbackTextInput {
  platform: PlatformName;
  failedCount: number;
  exportedAt: number;
  fileName: string;
  extensionVersion: string;
}

const PLATFORM_LABELS: Record<PlatformName, string> = {
  quark: '夸克网盘',
  aliyun: '阿里云盘',
  baidu: '百度网盘',
};

function buildSummary(input: BuildLastFailureDiagnosticSnapshotInput): DiagnosticSummary {
  const success = input.items.filter((item) => item.done === true).length;
  const failed = input.items.filter((item) => item.done === false && item.error).length;

  return {
    platform: input.platform,
    total: input.items.length,
    success,
    failed,
    retried: input.retried,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
  };
}

function buildFailureItems(items: DiagnosticExecutionItem[]): DiagnosticFailureItem[] {
  return items
    .filter((item) => item.done === false && item.error)
    .map((item) => ({
      fileId: item.fileId,
      originalName: item.originalName,
      targetName: item.targetName,
      errorMessage: item.error as string,
      attempt: 1,
    }));
}

export function buildLastFailureDiagnosticSnapshot(
  input: BuildLastFailureDiagnosticSnapshotInput
): LastFailureDiagnosticSnapshot | null {
  const failures = buildFailureItems(input.items);
  if (!failures.length) {
    return null;
  }

  return {
    failure: {
      id: `failure-${input.finishedAt}`,
      occurredAt: input.finishedAt,
      reason: 'batch-execution-failed',
      message: `${failures.length} files failed`,
    },
    summary: buildSummary(input),
    failures,
  };
}

export function buildDiagnosticFeedbackText(
  input: BuildDiagnosticFeedbackTextInput
): string {
  const platformLabel = PLATFORM_LABELS[input.platform];
  const exportedAt = new Date(input.exportedAt).toLocaleString('zh-CN', { hour12: false });

  return [
    `平台：${platformLabel}`,
    `扩展版本：${input.extensionVersion}`,
    `失败数量：${input.failedCount}`,
    `导出时间：${exportedAt}`,
    `诊断文件：${input.fileName}`,
  ].join('\n');
}
