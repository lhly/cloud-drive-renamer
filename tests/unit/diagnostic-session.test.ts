import { describe, expect, it } from 'vitest';
import {
  buildDiagnosticFeedbackText,
  buildLastFailureDiagnosticSnapshot,
} from '../../src/core/diagnostic-session';

describe('diagnostic-session', () => {
  it('builds failure snapshot from execution items', () => {
    const snapshot = buildLastFailureDiagnosticSnapshot({
      platform: 'quark',
      startedAt: 1710000000000,
      finishedAt: 1710000001000,
      retried: 1,
      items: [
        {
          fileId: 'file-1',
          originalName: 'old-a.txt',
          targetName: 'new-a.txt',
          done: true,
        },
        {
          fileId: 'file-2',
          originalName: 'old-b.txt',
          targetName: 'new-b.txt',
          done: false,
          error: 'network error',
        },
      ],
    });

    expect(snapshot).not.toBeNull();
    expect(snapshot?.summary.platform).toBe('quark');
    expect(snapshot?.summary.total).toBe(2);
    expect(snapshot?.summary.success).toBe(1);
    expect(snapshot?.summary.failed).toBe(1);
    expect(snapshot?.summary.retried).toBe(1);
    expect(snapshot?.failures[0]?.targetName).toBe('new-b.txt');
    expect(snapshot?.failure.reason).toBe('batch-execution-failed');
  });

  it('builds feedback summary text with platform and file name', () => {
    const text = buildDiagnosticFeedbackText({
      platform: 'quark',
      failedCount: 2,
      exportedAt: 1710000001000,
      fileName: 'cloud-drive-renamer-diagnostic-2026-03-20-1010.json',
      extensionVersion: '1.0.4',
    });

    expect(text).toContain('夸克网盘');
    expect(text).toContain('1.0.4');
    expect(text).toContain('2');
    expect(text).toContain('cloud-drive-renamer-diagnostic-2026-03-20-1010.json');
  });
});
