import { installCloudDrivePageScript } from '../shared/page-script';

export const DRIVE115_PAGE_SCRIPT_OPTIONS = {
  requestType: 'DRIVE115_API_REQUEST',
  responseType: 'DRIVE115_API_RESPONSE',
  readyFlagName: '__DRIVE115_PAGE_SCRIPT_READY__',
  datasetReadyKey: 'drive115PageScriptReady',
  datasetTimestampKey: 'drive115PageScriptTimestamp',
  logPrefix: 'Drive115PageScript',
};

installCloudDrivePageScript(DRIVE115_PAGE_SCRIPT_OPTIONS);
