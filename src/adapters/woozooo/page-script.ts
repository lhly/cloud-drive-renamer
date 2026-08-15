import { installCloudDrivePageScript, type PageScriptInstallOptions } from '../shared/page-script';

export const WOOZOOO_PAGE_SCRIPT_OPTIONS: PageScriptInstallOptions = {
  requestType: 'WOOZOOO_API_REQUEST',
  responseType: 'WOOZOOO_API_RESPONSE',
  readyFlagName: '__WOOZOOO_PAGE_SCRIPT_READY__',
  datasetReadyKey: 'woozoooPageScriptReady',
  datasetTimestampKey: 'woozoooPageScriptTimestamp',
  logPrefix: 'WoozoooPageScript',
  captureHeaders: [],
};

installCloudDrivePageScript(WOOZOOO_PAGE_SCRIPT_OPTIONS);
