import type { FileItem, PlatformConfig, PlatformName, RenameResult } from '../../types/platform';
import { parseFileName } from '../../utils/helpers';
import { SharedCloudDriveAdapter, type PageScriptAPI } from '../shared/shared-cloud-drive-adapter';
import { getCMCCPageScriptInjector } from './page-script-injector';

interface CMCCFileItem {
  fileId?: string | number;
  name?: string;
  parentFileId?: string | number;
  fileExtension?: string;
  size?: string | number;
  updatedAt?: string | number;
  updated_at?: string | number;
  type?: string;
}

interface CMCCListResponse {
  data?: {
    items?: CMCCFileItem[];
    nextPageCursor?: string | number | null;
  };
  code?: string | number;
  message?: string;
}

interface CMCCUpdateResponse {
  code?: string | number;
  message?: string;
}

interface SignedJsonBody {
  bodyMode: 'json';
  data: unknown;
  headers: Record<string, string>;
}

export class CMCCAdapter extends SharedCloudDriveAdapter {
  readonly platform: PlatformName = 'cmcc';

  constructor(config?: Partial<PlatformConfig>) {
    super({ platform: 'cmcc', requestInterval: 800, maxRetries: 3, timeout: 30000, ...config });
  }

  async getAllFiles(parentId?: string): Promise<FileItem[]> {
    const targetParentId = parentId || this.getCurrentFolderId();
    const files: FileItem[] = [];
    let cursor: { type: 'initial' | 'normal'; value: string | number | null } = { type: 'initial', value: null };

    while (cursor.type === 'initial' || cursor.value) {
      const payload = {
        pageInfo: { pageSize: 100, pageCursor: cursor.value },
        orderBy: 'updated_at',
        orderDirection: 'DESC',
        parentFileId: targetParentId,
        imageThumbnailStyleList: ['Small', 'Large'],
      };
      const signPayload = {
        commonAccountInfo: {
          account: this.getDecodedCookie('ORCHES-I-ACCOUNT-ENCRYPT'),
          accountType: 1,
        },
        catalogID: targetParentId,
        catalogSortType: 0,
        contentSortType: 0,
        endNumber: 100,
        filterType: 0,
        sortDirection: 1,
        startNumber: cursor.type === 'initial' ? 1 : cursor.value,
      };

      const response = this.normalizeResponse<CMCCListResponse>(await this.callAPI(
        'POST',
        'https://personal-kd-njs.yun.139.com/hcy/file/list',
        this.createSignedJsonBody(payload, signPayload)
      ));
      this.assertSuccessful(this.isSuccessfulResponseCode(response.code), response.code, response.message || '移动云盘列表获取失败', response);

      const list = response.data?.items;
      if (!Array.isArray(list)) {
        const responseKeys = Object.keys(response || {}).join(',') || 'none';
        const dataKeys = response.data ? Object.keys(response.data).join(',') || 'none' : 'none';
        throw new Error(`移动云盘列表获取失败: missing file list (response keys: ${responseKeys}; data keys: ${dataKeys})`);
      }

      files.push(...list.filter((item) => item.type !== 'folder').map((item) => this.toFileItem(item, targetParentId)));
      cursor = { type: 'normal', value: response.data?.nextPageCursor ?? null };
    }

    return files;
  }

  async renameFile(fileId: string, newName: string): Promise<RenameResult> {
    return this.retryableRename(async () => {
      const payload = { fileId, name: newName, description: '' };
      const signPayload = {
        commonAccountInfo: {
          account: this.getDecodedCookie('ORCHES-I-ACCOUNT-ENCRYPT'),
          accountType: 1,
        },
        contentID: fileId,
        contentName: newName,
      };
      const response = this.normalizeResponse<CMCCUpdateResponse>(await this.callAPI(
        'POST',
        'https://personal-kd-njs.yun.139.com/hcy/file/update',
        this.createSignedJsonBody(payload, signPayload)
      ));
      this.assertSuccessful(this.isSuccessfulResponseCode(response.code), response.code, response.message || '移动云盘重命名失败', response);
    }, fileId, newName);
  }

  protected getCurrentFolderId(): string {
    return localStorage.getItem('currentCatalogID') || 'root';
  }

  protected getPageScriptAPI(): PageScriptAPI {
    return getCMCCPageScriptInjector();
  }

  private isSuccessfulResponseCode(code: string | number | undefined): boolean {
    const normalized = String(code ?? '0').toLowerCase();
    return normalized === '0' || normalized === '0000' || normalized === '200' || normalized === 'success';
  }

  private normalizeResponse<T>(response: unknown): T {
    let current = response;

    for (let attempt = 0; attempt < 3; attempt++) {
      if (typeof current === 'string') {
        const text = current.trim();
        if (!text) return {} as T;
        try {
          current = JSON.parse(text) as unknown;
          continue;
        } catch {
          break;
        }
      }

      if (current && typeof current === 'object' && !Array.isArray(current)) {
        const text = (current as { text?: unknown }).text;
        if (typeof text === 'string') {
          current = text;
          continue;
        }
      }

      break;
    }

    return current as T;
  }

  private toFileItem(item: CMCCFileItem, parentId: string): FileItem {
    const name = item.name || '';
    const parsed = parseFileName(name);
    return {
      id: String(item.fileId),
      name,
      ext: item.fileExtension ? `.${String(item.fileExtension).replace(/^\./, '')}` : parsed.ext,
      parentId: String(item.parentFileId || parentId),
      size: Number(item.size ?? 0) || 0,
      mtime: this.normalizeTime(item.updatedAt ?? item.updated_at),
    };
  }

  private createSignedJsonBody(data: unknown, signPayload: unknown): SignedJsonBody {
    const time = this.formatTime(new Date());
    const random = 'FO6ezlJ9BkwfHVZd';
    return {
      bodyMode: 'json',
      data,
      headers: {
        Authorization: this.getCookie('authorization'),
        'Mcloud-Sign': `${time},${random},${this.getSign(signPayload, time, random)}`,
      },
    };
  }

  private getSign(signPayload: unknown, time: string, random: string): string {
    let sorted = '';
    if (signPayload) {
      const encoded = encodeURIComponent(JSON.stringify(signPayload));
      sorted = encoded.split('').sort().join('');
    }
    const payloadDigest = md5(window.btoa(sorted));
    const timeDigest = md5(`${time}:${random}`);
    return md5(payloadDigest + timeDigest).toUpperCase();
  }

  private getCookie(key: string): string {
    return document.cookie
      .split('; ')
      .map((item) => item.split('=', 2))
      .find(([name]) => name === key)?.[1] || '';
  }

  private getDecodedCookie(key: string): string {
    const value = this.getCookie(key);
    if (!value) return '';
    try {
      return window.atob(value);
    } catch {
      return '';
    }
  }

  private formatTime(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }
}

export function md5(input: string): string {
  return hex(md51(input));
}

function md5cycle(x: number[], k: number[]): void {
  let [a, b, c, d] = x;
  a = ff(a, b, c, d, k[0], 7, -680876936);
  d = ff(d, a, b, c, k[1], 12, -389564586);
  c = ff(c, d, a, b, k[2], 17, 606105819);
  b = ff(b, c, d, a, k[3], 22, -1044525330);
  a = ff(a, b, c, d, k[4], 7, -176418897);
  d = ff(d, a, b, c, k[5], 12, 1200080426);
  c = ff(c, d, a, b, k[6], 17, -1473231341);
  b = ff(b, c, d, a, k[7], 22, -45705983);
  a = ff(a, b, c, d, k[8], 7, 1770035416);
  d = ff(d, a, b, c, k[9], 12, -1958414417);
  c = ff(c, d, a, b, k[10], 17, -42063);
  b = ff(b, c, d, a, k[11], 22, -1990404162);
  a = ff(a, b, c, d, k[12], 7, 1804603682);
  d = ff(d, a, b, c, k[13], 12, -40341101);
  c = ff(c, d, a, b, k[14], 17, -1502002290);
  b = ff(b, c, d, a, k[15], 22, 1236535329);
  a = gg(a, b, c, d, k[1], 5, -165796510);
  d = gg(d, a, b, c, k[6], 9, -1069501632);
  c = gg(c, d, a, b, k[11], 14, 643717713);
  b = gg(b, c, d, a, k[0], 20, -373897302);
  a = gg(a, b, c, d, k[5], 5, -701558691);
  d = gg(d, a, b, c, k[10], 9, 38016083);
  c = gg(c, d, a, b, k[15], 14, -660478335);
  b = gg(b, c, d, a, k[4], 20, -405537848);
  a = gg(a, b, c, d, k[9], 5, 568446438);
  d = gg(d, a, b, c, k[14], 9, -1019803690);
  c = gg(c, d, a, b, k[3], 14, -187363961);
  b = gg(b, c, d, a, k[8], 20, 1163531501);
  a = gg(a, b, c, d, k[13], 5, -1444681467);
  d = gg(d, a, b, c, k[2], 9, -51403784);
  c = gg(c, d, a, b, k[7], 14, 1735328473);
  b = gg(b, c, d, a, k[12], 20, -1926607734);
  a = hh(a, b, c, d, k[5], 4, -378558);
  d = hh(d, a, b, c, k[8], 11, -2022574463);
  c = hh(c, d, a, b, k[11], 16, 1839030562);
  b = hh(b, c, d, a, k[14], 23, -35309556);
  a = hh(a, b, c, d, k[1], 4, -1530992060);
  d = hh(d, a, b, c, k[4], 11, 1272893353);
  c = hh(c, d, a, b, k[7], 16, -155497632);
  b = hh(b, c, d, a, k[10], 23, -1094730640);
  a = hh(a, b, c, d, k[13], 4, 681279174);
  d = hh(d, a, b, c, k[0], 11, -358537222);
  c = hh(c, d, a, b, k[3], 16, -722521979);
  b = hh(b, c, d, a, k[6], 23, 76029189);
  a = hh(a, b, c, d, k[9], 4, -640364487);
  d = hh(d, a, b, c, k[12], 11, -421815835);
  c = hh(c, d, a, b, k[15], 16, 530742520);
  b = hh(b, c, d, a, k[2], 23, -995338651);
  a = ii(a, b, c, d, k[0], 6, -198630844);
  d = ii(d, a, b, c, k[7], 10, 1126891415);
  c = ii(c, d, a, b, k[14], 15, -1416354905);
  b = ii(b, c, d, a, k[5], 21, -57434055);
  a = ii(a, b, c, d, k[12], 6, 1700485571);
  d = ii(d, a, b, c, k[3], 10, -1894986606);
  c = ii(c, d, a, b, k[10], 15, -1051523);
  b = ii(b, c, d, a, k[1], 21, -2054922799);
  a = ii(a, b, c, d, k[8], 6, 1873313359);
  d = ii(d, a, b, c, k[15], 10, -30611744);
  c = ii(c, d, a, b, k[6], 15, -1560198380);
  b = ii(b, c, d, a, k[13], 21, 1309151649);
  a = ii(a, b, c, d, k[4], 6, -145523070);
  d = ii(d, a, b, c, k[11], 10, -1120210379);
  c = ii(c, d, a, b, k[2], 15, 718787259);
  b = ii(b, c, d, a, k[9], 21, -343485551);
  x[0] = add32(a, x[0]);
  x[1] = add32(b, x[1]);
  x[2] = add32(c, x[2]);
  x[3] = add32(d, x[3]);
}

function cmn(q: number, a: number, b: number, x: number, s: number, t: number): number {
  a = add32(add32(a, q), add32(x, t));
  return add32((a << s) | (a >>> (32 - s)), b);
}

function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
  return cmn((b & c) | (~b & d), a, b, x, s, t);
}

function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
  return cmn((b & d) | (c & ~d), a, b, x, s, t);
}

function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
  return cmn(b ^ c ^ d, a, b, x, s, t);
}

function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
  return cmn(c ^ (b | ~d), a, b, x, s, t);
}

function md51(s: string): number[] {
  const txt = unescape(encodeURIComponent(s));
  const n = txt.length;
  const state = [1732584193, -271733879, -1732584194, 271733878];
  let i = 64;
  for (; i <= n; i += 64) md5cycle(state, md5blk(txt.substring(i - 64, i)));
  const tail = new Array<number>(16).fill(0);
  const rest = txt.substring(i - 64);
  for (i = 0; i < rest.length; i++) tail[i >> 2] |= rest.charCodeAt(i) << ((i % 4) << 3);
  tail[i >> 2] |= 0x80 << ((i % 4) << 3);
  if (i > 55) {
    md5cycle(state, tail);
    tail.fill(0);
  }
  tail[14] = n * 8;
  md5cycle(state, tail);
  return state;
}

function md5blk(s: string): number[] {
  const blocks: number[] = [];
  for (let i = 0; i < 64; i += 4) {
    blocks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
  }
  return blocks;
}

const hexChars = '0123456789abcdef'.split('');

function rhex(n: number): string {
  let s = '';
  for (let j = 0; j < 4; j++) s += hexChars[(n >> (j * 8 + 4)) & 0x0f] + hexChars[(n >> (j * 8)) & 0x0f];
  return s;
}

function hex(x: number[]): string {
  return x.map(rhex).join('');
}

function add32(a: number, b: number): number {
  return (a + b) & 0xffffffff;
}
