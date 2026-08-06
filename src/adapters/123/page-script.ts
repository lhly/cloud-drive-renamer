import { installCloudDrivePageScript } from '../shared/page-script';

export const DRIVE123_PAGE_SCRIPT_OPTIONS = {
  requestType: 'DRIVE123_API_REQUEST',
  responseType: 'DRIVE123_API_RESPONSE',
  readyFlagName: '__DRIVE123_PAGE_SCRIPT_READY__',
  datasetReadyKey: 'drive123PageScriptReady',
  datasetTimestampKey: 'drive123PageScriptTimestamp',
  logPrefix: 'Drive123PageScript',
  captureHeaders: ['authorization'],
};

installCloudDrivePageScript(DRIVE123_PAGE_SCRIPT_OPTIONS);
