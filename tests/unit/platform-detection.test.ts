/**
 * 平台检测单元测试
 * 验证统一的平台检测工具函数正确识别个人网盘和分享链接
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { detectPlatformFromUrl, isQuarkShareLink, QUARK_SHARE_LINK_PATTERNS } from '../../src/utils/platform-detector';
import { detectPlatform } from '../../src/content/index';
import { logger } from '../../src/utils/logger';

// Mock logger 模块
vi.mock('../../src/utils/logger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/utils/logger')>();
  return {
    ...actual,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
});

describe('Platform Detection - Unified Utils', () => {
  beforeEach(() => {
    // 重置所有 mock
    vi.clearAllMocks();
  });

  describe('isQuarkShareLink() - Share Link Pattern Detection', () => {
    it('should detect basic share link pattern', () => {
      expect(isQuarkShareLink('/s/abc123xyz')).toBe(true);
    });

    it('should detect share link with trailing slash', () => {
      expect(isQuarkShareLink('/s/abc123xyz/')).toBe(true);
    });

    it('should detect share link with nested path', () => {
      expect(isQuarkShareLink('/s/share/folder')).toBe(true);
    });

    it('should return false for personal storage path', () => {
      expect(isQuarkShareLink('/list')).toBe(false);
      expect(isQuarkShareLink('/list/all')).toBe(false);
      expect(isQuarkShareLink('/settings')).toBe(false);
    });

    it('should handle null pathname defensively', () => {
      expect(isQuarkShareLink(null)).toBe(false);
    });

    it('should handle undefined pathname defensively', () => {
      expect(isQuarkShareLink(undefined)).toBe(false);
    });

    it('should handle empty string', () => {
      expect(isQuarkShareLink('')).toBe(false);
    });

    it('should use configurable patterns from constant', () => {
      // 验证函数使用了导出的常量
      expect(QUARK_SHARE_LINK_PATTERNS).toContain('/s/');
    });
  });

  describe('detectPlatformFromUrl() - Unified Detection Logic', () => {
    describe('Quark Drive - Personal Storage', () => {
      it('should detect personal file list page', () => {
        const result = detectPlatformFromUrl(
          'https://pan.quark.cn/list#/list/all',
          '/list'
        );
        expect(result).toBe('quark');
      });

      it('should detect personal folder page', () => {
        const result = detectPlatformFromUrl(
          'https://pan.quark.cn/list#/list/folder/12345',
          '/list'
        );
        expect(result).toBe('quark');
      });

      it('should detect personal recent files page', () => {
        const result = detectPlatformFromUrl(
          'https://pan.quark.cn/list#/recent',
          '/list'
        );
        expect(result).toBe('quark');
      });

      it('should detect settings page', () => {
        const result = detectPlatformFromUrl(
          'https://pan.quark.cn/settings',
          '/settings'
        );
        expect(result).toBe('quark');
      });
    });

    describe('Quark Drive - Share Links (Should Return null)', () => {
      it('should return null for basic share link', () => {
        const result = detectPlatformFromUrl(
          'https://pan.quark.cn/s/abc123xyz',
          '/s/abc123xyz'
        );
        expect(result).toBeNull();
      });

      it('should return null for share link with password', () => {
        const result = detectPlatformFromUrl(
          'https://pan.quark.cn/s/abc123xyz?pwd=1234',
          '/s/abc123xyz'
        );
        expect(result).toBeNull();
      });

      it('should return null for share link with hash fragment', () => {
        const result = detectPlatformFromUrl(
          'https://pan.quark.cn/s/xyz789#/folder',
          '/s/xyz789'
        );
        expect(result).toBeNull();
      });

      it('should return null for share link with query parameters', () => {
        const result = detectPlatformFromUrl(
          'https://pan.quark.cn/s/shared123?from=mobile&source=qr',
          '/s/shared123'
        );
        expect(result).toBeNull();
      });

      it('should handle pathname with trailing slash', () => {
        const result = detectPlatformFromUrl(
          'https://pan.quark.cn/s/test123/',
          '/s/test123/'
        );
        expect(result).toBeNull();
      });

      it('should handle nested share path', () => {
        const result = detectPlatformFromUrl(
          'https://pan.quark.cn/s/share/folder',
          '/s/share/folder'
        );
        expect(result).toBeNull();
      });
    });

    describe('Auto pathname extraction (when pathname not provided)', () => {
      it('should extract pathname from URL for personal storage', () => {
        const result = detectPlatformFromUrl('https://pan.quark.cn/list#/list/all');
        expect(result).toBe('quark');
      });

      it('should extract pathname from URL for share link', () => {
        const result = detectPlatformFromUrl('https://pan.quark.cn/s/abc123xyz');
        expect(result).toBeNull();
      });
    });

    describe('Other Platforms - Unchanged Behavior', () => {
      it('should detect UC Drive from drive.uc.cn', () => {
        const result = detectPlatformFromUrl(
          'https://drive.uc.cn/#/list/all',
          '/'
        );
        expect(result).toBe('uc');
      });

      it('should detect UC Drive from pan.uc.cn', () => {
        const result = detectPlatformFromUrl(
          'https://pan.uc.cn/#/list/all/abc123-folder',
          '/'
        );
        expect(result).toBe('uc');
      });

      it('should detect 115 Drive on supported netdisk page', () => {
        const result = detectPlatformFromUrl(
          'https://115.com/storage/netdisk?mode=wangpan&cid=folder115',
          '/storage/netdisk'
        );
        expect(result).toBe('115');
      });

      it('should detect 115 Drive entry pages so the floating button can initialize before SPA navigation', () => {
        const result = detectPlatformFromUrl(
          'https://115.com/',
          '/'
        );
        expect(result).toBe('115');
      });

      it('should ignore unsupported 115 pages', () => {
        const result = detectPlatformFromUrl(
          'https://115.com/account/settings',
          '/account/settings'
        );
        expect(result).toBeNull();
      });

      it('should detect 123 Drive on yun.123pan.cn file pages', () => {
        const result = detectPlatformFromUrl(
          'https://yun.123pan.cn/?remember=yes&homeFilePath=31611662',
          '/'
        );
        expect(result).toBe('123');
      });

      it('should ignore 123Pan product homepage', () => {
        const result = detectPlatformFromUrl(
          'https://www.123pan.com/',
          '/'
        );
        expect(result).toBeNull();
      });

      it('should detect CMCC Drive', () => {
        const result = detectPlatformFromUrl(
          'https://yun.139.com/w/#/main',
          '/w/'
        );
        expect(result).toBe('cmcc');
      });

      it('should detect CMCC Drive on the SPA index route', () => {
        const result = detectPlatformFromUrl(
          'https://yun.139.com/w/#/index',
          '/w/'
        );
        expect(result).toBe('cmcc');
      });

      it('should detect CMCC Drive on the app entry before hash routing is ready', () => {
        const result = detectPlatformFromUrl(
          'https://yun.139.com/w/',
          '/w/'
        );
        expect(result).toBe('cmcc');
      });

      it('should detect Xunlei Drive', () => {
        const result = detectPlatformFromUrl(
          'https://pan.xunlei.com/',
          '/'
        );
        expect(result).toBe('xunlei');
      });

      it('should detect Esurfing Drive entry page before navigating into file lists', () => {
        const result = detectPlatformFromUrl(
          'https://cloud.189.cn/web/main/',
          '/web/main/'
        );
        expect(result).toBe('esurfing');
      });

      it('should detect Esurfing Drive', () => {
        const result = detectPlatformFromUrl(
          'https://cloud.189.cn/web/main/file/folder/folder189',
          '/web/main/file/folder/folder189'
        );
        expect(result).toBe('esurfing');
      });

      it('should detect Aliyun Drive', () => {
        const result = detectPlatformFromUrl(
          'https://www.aliyundrive.com/drive/file/all',
          '/drive/file/all'
        );
        expect(result).toBe('aliyun');
      });

      it('should detect Baidu Drive', () => {
        const result = detectPlatformFromUrl(
          'https://pan.baidu.com/disk/home',
          '/disk/home'
        );
        expect(result).toBe('baidu');
      });

      it('should return null for unsupported platform', () => {
        const result = detectPlatformFromUrl(
          'https://example.com/',
          '/'
        );
        expect(result).toBeNull();
      });
    });

    describe('Edge Cases - Robustness', () => {
      it('should handle malformed URL gracefully', () => {
        const result = detectPlatformFromUrl('not-a-valid-url');
        expect(result).toBeNull();
      });

      it('should handle empty pathname', () => {
        const result = detectPlatformFromUrl('https://pan.quark.cn/', '');
        expect(result).toBe('quark');
      });
    });
  });

  describe('detectPlatform() - Content Script Integration', () => {
    beforeEach(() => {
      // 重置 window.location mock
      delete (window as any).location;
    });

    it('should detect personal storage and not log warning', () => {
      Object.defineProperty(window, 'location', {
        value: {
          href: 'https://pan.quark.cn/list#/list/all',
          pathname: '/list'
        },
        writable: true,
        configurable: true
      });

      const result = detectPlatform();

      expect(result).toBe('quark');
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should detect share link and log warning', () => {
      Object.defineProperty(window, 'location', {
        value: {
          href: 'https://pan.quark.cn/s/abc123xyz',
          pathname: '/s/abc123xyz'
        },
        writable: true,
        configurable: true
      });

      const result = detectPlatform();

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        'Quark share link detected, extension disabled for share pages'
      );
    });

    it('should return null for unsupported platform without warning', () => {
      Object.defineProperty(window, 'location', {
        value: {
          href: 'https://example.com/',
          pathname: '/'
        },
        writable: true,
        configurable: true
      });

      const result = detectPlatform();

      expect(result).toBeNull();
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });
});
