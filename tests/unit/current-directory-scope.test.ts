import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuarkAdapter } from '../../src/adapters/quark/quark';
import { AliyunAdapter } from '../../src/adapters/aliyun/aliyun-adapter';
import { BaiduAdapter } from '../../src/adapters/baidu/baidu-adapter';

describe('current directory scope', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('QuarkAdapter should expose current directory key from query string', () => {
    Object.defineProperty(window, 'location', {
      value: {
        search: '?dir_id=test-dir-123',
        hash: '',
      },
      writable: true,
      configurable: true,
    });

    const adapter = new QuarkAdapter();

    expect(adapter.getCurrentDirectoryKey()).toBe('test-dir-123');
  });

  it('AliyunAdapter should expose current directory key from pathname', () => {
    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/drive/file/all/66f55e9a8b9c4d0eaa11223344556677',
      },
      writable: true,
      configurable: true,
    });

    const adapter = new AliyunAdapter();

    expect(adapter.getCurrentDirectoryKey()).toBe('66f55e9a8b9c4d0eaa11223344556677');
  });

  it('BaiduAdapter should expose current directory key from decoded path query', () => {
    Object.defineProperty(window, 'location', {
      value: {
        search: '?path=%2Fvideo%2Fseason1',
        hash: '',
      },
      writable: true,
      configurable: true,
    });

    const adapter = new BaiduAdapter();

    expect(adapter.getCurrentDirectoryKey()).toBe('/video/season1');
  });
});
