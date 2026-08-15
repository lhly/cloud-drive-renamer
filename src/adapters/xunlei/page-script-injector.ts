import { CloudDrivePageScriptInjector } from '../shared/page-script-injector';

let instance: CloudDrivePageScriptInjector | null = null;

export function getXunleiPageScriptInjector(): CloudDrivePageScriptInjector {
  if (!instance) {
    instance = new CloudDrivePageScriptInjector({
      requestType: 'XUNLEI_API_REQUEST',
      responseType: 'XUNLEI_API_RESPONSE',
      readyFlagName: '__XUNLEI_PAGE_SCRIPT_READY__',
      datasetReadyKey: 'xunleiPageScriptReady',
      datasetTimestampKey: 'xunleiPageScriptTimestamp',
      logPrefix: 'Xunlei',
    });
  }
  return instance;
}
