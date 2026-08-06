import { CloudDrivePageScriptInjector } from '../shared/page-script-injector';

let instance: CloudDrivePageScriptInjector | null = null;

export function getDrive123PageScriptInjector(): CloudDrivePageScriptInjector {
  if (!instance) {
    instance = new CloudDrivePageScriptInjector({
      requestType: 'DRIVE123_API_REQUEST',
      responseType: 'DRIVE123_API_RESPONSE',
      readyFlagName: '__DRIVE123_PAGE_SCRIPT_READY__',
      datasetReadyKey: 'drive123PageScriptReady',
      datasetTimestampKey: 'drive123PageScriptTimestamp',
      logPrefix: 'Drive123',
    });
  }
  return instance;
}
