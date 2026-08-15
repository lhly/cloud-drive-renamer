import { installCloudDrivePageScript } from '../shared/page-script';

export const XUNLEI_PAGE_SCRIPT_OPTIONS = {
  requestType: 'XUNLEI_API_REQUEST',
  responseType: 'XUNLEI_API_RESPONSE',
  readyFlagName: '__XUNLEI_PAGE_SCRIPT_READY__',
  datasetReadyKey: 'xunleiPageScriptReady',
  datasetTimestampKey: 'xunleiPageScriptTimestamp',
  logPrefix: 'XunleiPageScript',
  captureHeaders: ['authorization', 'x-device-id', 'x-client-id', 'x-captcha-token', 'content-type'],
};

installCloudDrivePageScript(XUNLEI_PAGE_SCRIPT_OPTIONS);
