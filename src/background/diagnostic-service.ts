import {
  DIAGNOSTIC_STORAGE_KEYS,
  type DiagnosticExportPayload,
  type LastFailureDiagnosticSnapshot,
} from '../types/diagnostic';
import { type StorageManager, storage } from '../utils/storage';
import { DiagnosticLogStore } from './diagnostic-log-store';

type DiagnosticServiceStorage = Pick<StorageManager, 'get' | 'set' | 'remove'>;
type DiagnosticServiceLogStore = Pick<DiagnosticLogStore, 'append' | 'getRecent' | 'clear'>;

export class DiagnosticService {
  constructor(
    private readonly storageManager: DiagnosticServiceStorage = storage,
    private readonly logStore: DiagnosticServiceLogStore = new DiagnosticLogStore(storage)
  ) {}

  async appendLog(entry: Parameters<DiagnosticServiceLogStore['append']>[0]): Promise<void> {
    await this.logStore.append(entry);
  }

  async getExportPayload(): Promise<DiagnosticExportPayload> {
    const [lastFailure, logs] = await Promise.all([
      this.storageManager.get<LastFailureDiagnosticSnapshot>(DIAGNOSTIC_STORAGE_KEYS.LAST_FAILURE),
      this.logStore.getRecent(),
    ]);

    return {
      exportedAt: Date.now(),
      lastFailure,
      logs,
    };
  }

  async openExternalUrl(url: string): Promise<void> {
    await chrome.tabs.create({ url });
  }
}

export const diagnosticService = new DiagnosticService();
