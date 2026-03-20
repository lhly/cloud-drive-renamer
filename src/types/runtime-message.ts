import { type DiagnosticExportPayload, type DiagnosticLogEntry } from './diagnostic';

export const RUNTIME_MESSAGE_TYPES = {
  APPEND_DIAGNOSTIC_LOG: 'APPEND_DIAGNOSTIC_LOG',
  GET_DIAGNOSTIC_EXPORT: 'GET_DIAGNOSTIC_EXPORT',
  OPEN_EXTERNAL_URL: 'OPEN_EXTERNAL_URL',
} as const;

export type RuntimeMessageType =
  (typeof RUNTIME_MESSAGE_TYPES)[keyof typeof RUNTIME_MESSAGE_TYPES];

export interface AppendDiagnosticLogMessage {
  type: typeof RUNTIME_MESSAGE_TYPES.APPEND_DIAGNOSTIC_LOG;
  entry: DiagnosticLogEntry;
}

export interface GetDiagnosticExportMessage {
  type: typeof RUNTIME_MESSAGE_TYPES.GET_DIAGNOSTIC_EXPORT;
}

export interface OpenExternalUrlMessage {
  type: typeof RUNTIME_MESSAGE_TYPES.OPEN_EXTERNAL_URL;
  url: string;
}

export type RuntimeMessage =
  | AppendDiagnosticLogMessage
  | GetDiagnosticExportMessage
  | OpenExternalUrlMessage;

export interface RuntimeSuccessResponse {
  success: true;
}

export interface DiagnosticExportResponse {
  payload: DiagnosticExportPayload;
}

export interface RuntimeErrorResponse {
  success: false;
  error: string;
}
