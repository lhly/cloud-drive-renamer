import { installCloudDrivePageScript, type PageScriptInstallOptions } from '../shared/page-script';

export const CMCC_PAGE_SCRIPT_OPTIONS: PageScriptInstallOptions = {
  requestType: 'CMCC_API_REQUEST',
  responseType: 'CMCC_API_RESPONSE',
  readyFlagName: '__CMCC_PAGE_SCRIPT_READY__',
  datasetReadyKey: 'cmccPageScriptReady',
  datasetTimestampKey: 'cmccPageScriptTimestamp',
  logPrefix: 'CMCCPageScript',
  transport: 'xhr',
  captureHeaders: [
    'caller',
    'Cms-Device',
    'Mcloud-Channel',
    'Mcloud-Client',
    'Mcloud-Route',
    'Mcloud-version',
    'X-Deviceinfo',
    'x-huawei-channelSrc',
    'x-m4c-src',
    'x-inner-ntwk',
    'x-m4c-caller',
    'INNER-HCY-ROUTER-HTTPS',
    'X-Svctype',
    'x-yun-Api-Version',
    'x-yun-channel-source',
    'x-yun-app-channel',
    'x-yun-client-info',
    'x-yun-module-type',
    'x-yun-svc-type',
  ],
};

installCloudDrivePageScript(CMCC_PAGE_SCRIPT_OPTIONS);
