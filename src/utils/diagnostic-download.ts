import { buildDiagnosticFeedbackText } from '../core/diagnostic-session';
import type { DiagnosticExportPayload } from '../types/diagnostic';
import type { PlatformName } from '../types/platform';

const DIAGNOSTIC_GITHUB_ISSUES_URL = 'https://github.com/lhly/cloud-drive-renamer/issues/new';
const DIAGNOSTIC_FEEDBACK_EMAIL = 'lhlyzh@qq.com';

interface DiagnosticFeedbackLinkInput {
  platform: PlatformName;
  failedCount: number;
  exportedAt: number;
  fileName: string;
  extensionVersion: string;
}

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

function buildDiagnosticFileName(exportedAt: number): string {
  const date = new Date(exportedAt);
  const year = date.getFullYear();
  const month = padDatePart(date.getMonth() + 1);
  const day = padDatePart(date.getDate());
  const hours = padDatePart(date.getHours());
  const minutes = padDatePart(date.getMinutes());

  return `cloud-drive-renamer-diagnostic-${year}-${month}-${day}-${hours}${minutes}.json`;
}

export async function downloadDiagnosticPayload(
  payload: DiagnosticExportPayload
): Promise<string> {
  const fileName = buildDiagnosticFileName(payload.exportedAt);
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const objectUrl = URL.createObjectURL(blob);

  try {
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  return fileName;
}

export function buildGithubIssueUrl(input: DiagnosticFeedbackLinkInput): string {
  const title = `[Diagnostic] ${input.platform} rename failure`;
  const body = buildDiagnosticFeedbackText(input);
  const params = new URLSearchParams({
    title,
    body,
  });

  return `${DIAGNOSTIC_GITHUB_ISSUES_URL}?${params.toString()}`;
}

export function buildMailtoUrl(input: DiagnosticFeedbackLinkInput): string {
  const subject = `[CloudDrive Renamer] Diagnostic feedback (${input.platform})`;
  const body = buildDiagnosticFeedbackText(input);
  const params = new URLSearchParams({
    subject,
    body,
  });

  return `mailto:${DIAGNOSTIC_FEEDBACK_EMAIL}?${params.toString()}`;
}

export { buildDiagnosticFeedbackText };
