import { describe, expect, it, vi } from 'vitest';
import {
  DIAGNOSTIC_STORAGE_KEYS,
  type DiagnosticLogEntry,
  type LastFailureDiagnosticSnapshot,
} from '../../src/types/diagnostic';
import { DiagnosticService } from '../../src/background/diagnostic-service';

describe('DiagnosticService', () => {
  it('builds export payload from stored last failure and recent logs', async () => {
    const lastFailure: LastFailureDiagnosticSnapshot = {
      failure: {
        id: 'failure-1',
        occurredAt: 1710000000000,
        reason: 'batch-execution-failed',
        message: '2 files failed',
      },
      summary: {
        platform: 'quark',
        total: 2,
        success: 0,
        failed: 2,
        retried: 1,
        startedAt: 1710000000000,
        finishedAt: 1710000001000,
      },
      failures: [
        {
          fileId: 'file-1',
          originalName: 'old-a.txt',
          targetName: 'new-a.txt',
          errorMessage: 'rename failed',
          attempt: 1,
        },
      ],
    };
    const logs: DiagnosticLogEntry[] = [
      { id: 'log-1', level: 'INFO', message: 'start', timestamp: 1710000000001 },
      { id: 'log-2', level: 'ERROR', message: 'rename failed', timestamp: 1710000000002 },
    ];

    const storageManager = {
      get: vi.fn(async (key: string) =>
        key === DIAGNOSTIC_STORAGE_KEYS.LAST_FAILURE ? lastFailure : null
      ),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    };
    const logStore = {
      append: vi.fn(async () => undefined),
      getRecent: vi.fn(async () => logs),
      clear: vi.fn(async () => undefined),
    };

    const service = new DiagnosticService(storageManager as any, logStore as any);
    const payload = await service.getExportPayload();

    expect(payload.lastFailure?.failure.reason).toBe('batch-execution-failed');
    expect(payload.logs).toHaveLength(2);
    expect(payload.logs[1]?.message).toBe('rename failed');
    expect(payload.exportedAt).toBeTypeOf('number');
  });

  it('returns null lastFailure when no snapshot is stored', async () => {
    const storageManager = {
      get: vi.fn(async () => null),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    };
    const logStore = {
      append: vi.fn(async () => undefined),
      getRecent: vi.fn(async () => []),
      clear: vi.fn(async () => undefined),
    };

    const service = new DiagnosticService(storageManager as any, logStore as any);
    const payload = await service.getExportPayload();

    expect(payload.lastFailure).toBeNull();
    expect(payload.logs).toEqual([]);
  });
});
