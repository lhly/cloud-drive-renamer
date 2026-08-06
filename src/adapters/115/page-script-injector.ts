import { CloudDrivePageScriptInjector } from '../shared/page-script-injector';

let instance: CloudDrivePageScriptInjector | null = null;

export function getDrive115PageScriptInjector(): CloudDrivePageScriptInjector {
  if (!instance) {
    instance = new CloudDrivePageScriptInjector({
      requestType: 'DRIVE115_API_REQUEST',
      responseType: 'DRIVE115_API_RESPONSE',
      readyFlagName: '__DRIVE115_PAGE_SCRIPT_READY__',
      datasetReadyKey: 'drive115PageScriptReady',
      datasetTimestampKey: 'drive115PageScriptTimestamp',
      logPrefix: 'Drive115',
    });
  }
  return instance;
}
