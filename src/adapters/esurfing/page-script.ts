import { installCloudDrivePageScript } from '../shared/page-script';

export const ESURFING_PAGE_SCRIPT_OPTIONS = {
  requestType: 'ESURFING_API_REQUEST',
  responseType: 'ESURFING_API_RESPONSE',
  readyFlagName: '__ESURFING_PAGE_SCRIPT_READY__',
  datasetReadyKey: 'esurfingPageScriptReady',
  datasetTimestampKey: 'esurfingPageScriptTimestamp',
  logPrefix: 'EsurfingPageScript',
};

installCloudDrivePageScript(ESURFING_PAGE_SCRIPT_OPTIONS);
