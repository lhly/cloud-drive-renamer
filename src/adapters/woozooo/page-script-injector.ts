import { CloudDrivePageScriptInjector } from '../shared/page-script-injector';

let instance: CloudDrivePageScriptInjector | null = null;

export function getWoozoooPageScriptInjector(): CloudDrivePageScriptInjector {
  if (!instance) {
    instance = new CloudDrivePageScriptInjector({
      requestType: 'WOOZOOO_API_REQUEST',
      responseType: 'WOOZOOO_API_RESPONSE',
      readyFlagName: '__WOOZOOO_PAGE_SCRIPT_READY__',
      datasetReadyKey: 'woozoooPageScriptReady',
      datasetTimestampKey: 'woozoooPageScriptTimestamp',
      logPrefix: 'Woozooo',
    });
  }
  return instance;
}
