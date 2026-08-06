import { CloudDrivePageScriptInjector } from '../shared/page-script-injector';

let instance: CloudDrivePageScriptInjector | null = null;

export function getCMCCPageScriptInjector(): CloudDrivePageScriptInjector {
  if (!instance) {
    instance = new CloudDrivePageScriptInjector({
      requestType: 'CMCC_API_REQUEST',
      responseType: 'CMCC_API_RESPONSE',
      readyFlagName: '__CMCC_PAGE_SCRIPT_READY__',
      datasetReadyKey: 'cmccPageScriptReady',
      datasetTimestampKey: 'cmccPageScriptTimestamp',
      logPrefix: 'CMCC',
    });
  }
  return instance;
}
