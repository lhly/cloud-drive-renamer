import { describe, it, expect } from 'vitest';
import { parseFileName, validateFileName, sanitizeFileName, formatTime } from '../../src/utils/helpers';

describe('helpers', () => {
  describe('parseFileName', () => {
    it('should parse file name with extension', () => {
      const result = parseFileName('video.mp4');
      expect(result).toEqual({ name: 'video', ext: '.mp4' });
    });

    it('should handle file name without extension', () => {
      const result = parseFileName('README');
      expect(result).toEqual({ name: 'README', ext: '' });
    });

    it('should handle file name with multiple dots', () => {
      const result = parseFileName('archive.tar.gz');
      expect(result).toEqual({ name: 'archive.tar', ext: '.gz' });
    });

    it('should handle hidden files', () => {
      const result = parseFileName('.gitignore');
      expect(result).toEqual({ name: '.gitignore', ext: '' });
    });
  });

  describe('validateFileName', () => {
    it('should validate legal file name', () => {
      const result = validateFileName('normal_file-name.txt');
      expect(result.valid).toBe(true);
      expect(result.illegalChars).toBeUndefined();
    });

    it('should detect illegal characters', () => {
      const result = validateFileName('file:name?.txt');
      expect(result.valid).toBe(false);
      expect(result.illegalChars).toEqual([':', '?']);
      expect(result.sanitized).toBe('file_name_.txt');
    });
  });

  describe('sanitizeFileName', () => {
    it('should remove illegal characters', () => {
      const result = sanitizeFileName('file<>:"/\\|?*.txt');
      expect(result).toBe('file_________.txt');
    });

    it('should trim extra spaces', () => {
      const result = sanitizeFileName('  file   name  .txt  ');
      expect(result).toBe('file name .txt');
    });
  });

  describe('formatTime', () => {
    it('should format seconds', () => {
      expect(formatTime(30000)).toBe('30秒');
    });

    it('should format minutes', () => {
      expect(formatTime(120000)).toBe('2分0秒');
    });

    it('should format hours', () => {
      expect(formatTime(3660000)).toBe('1小时1分');
    });
  });
});
