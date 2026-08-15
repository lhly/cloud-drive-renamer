import { installCloudDrivePageScript, type PageScriptInstallOptions } from '../shared/page-script';

export const GUANGYAPAN_PAGE_SCRIPT_OPTIONS: PageScriptInstallOptions = {
  requestType: 'GUANGYAPAN_API_REQUEST',
  responseType: 'GUANGYAPAN_API_RESPONSE',
  readyFlagName: '__GUANGYAPAN_PAGE_SCRIPT_READY__',
  datasetReadyKey: 'guangyapanPageScriptReady',
  datasetTimestampKey: 'guangyapanPageScriptTimestamp',
  logPrefix: 'GuangyaPanPageScript',
  transport: 'xhr',
  captureHeaders: ['authorization', 'did', 'smid', 'dt', 'traceparent', 'accept', 'content-type'],
};

installCloudDrivePageScript(GUANGYAPAN_PAGE_SCRIPT_OPTIONS);
