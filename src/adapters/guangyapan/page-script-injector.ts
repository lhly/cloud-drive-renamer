import { CloudDrivePageScriptInjector } from '../shared/page-script-injector';

let instance: CloudDrivePageScriptInjector | null = null;

export function getGuangyaPanPageScriptInjector(): CloudDrivePageScriptInjector {
  if (!instance) {
    instance = new CloudDrivePageScriptInjector({
      requestType: 'GUANGYAPAN_API_REQUEST',
      responseType: 'GUANGYAPAN_API_RESPONSE',
      readyFlagName: '__GUANGYAPAN_PAGE_SCRIPT_READY__',
      datasetReadyKey: 'guangyapanPageScriptReady',
      datasetTimestampKey: 'guangyapanPageScriptTimestamp',
      logPrefix: 'GuangyaPan',
    });
  }
  return instance;
}
