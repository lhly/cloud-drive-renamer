import { type DiagnosticLogEntry, DIAGNOSTIC_STORAGE_KEYS } from '../types/diagnostic';
import { type StorageManager, storage } from '../utils/storage';

const MAX_RECENT_LOGS = 300;

type DiagnosticStoreStorage = Pick<StorageManager, 'get' | 'set' | 'remove'>;

export class DiagnosticLogStore {
  constructor(private readonly storageManager: DiagnosticStoreStorage = storage) {}

  async append(entry: DiagnosticLogEntry): Promise<void> {
    const recent = await this.getRecent();
    const next = [...recent, entry];

    if (next.length > MAX_RECENT_LOGS) {
      next.splice(0, next.length - MAX_RECENT_LOGS);
    }

    await this.storageManager.set(DIAGNOSTIC_STORAGE_KEYS.RECENT_LOGS, next);
  }

  async getRecent(): Promise<DiagnosticLogEntry[]> {
    const stored = await this.storageManager.get<DiagnosticLogEntry[]>(
      DIAGNOSTIC_STORAGE_KEYS.RECENT_LOGS
    );

    return Array.isArray(stored) ? stored : [];
  }

  async clear(): Promise<void> {
    await this.storageManager.remove(DIAGNOSTIC_STORAGE_KEYS.RECENT_LOGS);
  }
}
