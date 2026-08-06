import { CloudDrivePageScriptInjector } from '../shared/page-script-injector';

let instance: CloudDrivePageScriptInjector | null = null;

export function getEsurfingPageScriptInjector(): CloudDrivePageScriptInjector {
  if (!instance) {
    instance = new CloudDrivePageScriptInjector({
      requestType: 'ESURFING_API_REQUEST',
      responseType: 'ESURFING_API_RESPONSE',
      readyFlagName: '__ESURFING_PAGE_SCRIPT_READY__',
      datasetReadyKey: 'esurfingPageScriptReady',
      datasetTimestampKey: 'esurfingPageScriptTimestamp',
      logPrefix: 'Esurfing',
    });
  }
  return instance;
}
