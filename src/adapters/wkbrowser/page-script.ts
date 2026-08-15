import { installCloudDrivePageScript } from '../shared/page-script';

export const WKBROWSER_PAGE_SCRIPT_OPTIONS = {
  requestType: 'WKBROWSER_API_REQUEST',
  responseType: 'WKBROWSER_API_RESPONSE',
  readyFlagName: '__WKBROWSER_PAGE_SCRIPT_READY__',
  datasetReadyKey: 'wkbrowserPageScriptReady',
  datasetTimestampKey: 'wkbrowserPageScriptTimestamp',
  logPrefix: 'WKBrowserPageScript',
};

installCloudDrivePageScript(WKBROWSER_PAGE_SCRIPT_OPTIONS);
