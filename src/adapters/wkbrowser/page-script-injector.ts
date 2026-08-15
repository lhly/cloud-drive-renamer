import { CloudDrivePageScriptInjector } from '../shared/page-script-injector';

let instance: CloudDrivePageScriptInjector | null = null;

export function getWKBrowserPageScriptInjector(): CloudDrivePageScriptInjector {
  if (!instance) {
    instance = new CloudDrivePageScriptInjector({
      requestType: 'WKBROWSER_API_REQUEST',
      responseType: 'WKBROWSER_API_RESPONSE',
      readyFlagName: '__WKBROWSER_PAGE_SCRIPT_READY__',
      datasetReadyKey: 'wkbrowserPageScriptReady',
      datasetTimestampKey: 'wkbrowserPageScriptTimestamp',
      logPrefix: 'WKBrowser',
    });
  }
  return instance;
}
