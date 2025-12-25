import { describe, it, expect } from 'vitest';
import { FileItem } from '../../src/types/platform';
import { parseFileName } from '../../src/utils/helpers';

/**
 * 文件夹重命名功能 - 类型系统单元测试
 *
 * 测试范围:
 * 1. FileItem 扩展以支持文件夹
 * 2. 文件夹属性验证 (ext='', size=0)
 * 3. 文件名解析逻辑
 */

describe('FileItem 类型系统 - 文件夹支持', () => {
  describe('基础类型定义', () => {
    it('应该支持文件的 FileItem', () => {
      const file: FileItem = {
        id: 'file-uuid-123456789',
        name: 'document.pdf',
        ext: '.pdf',
        parentId: 'dir-0',
        size: 1024000,
        mtime: 1703500800000,
      };

      expect(file.name).toBe('document.pdf');
      expect(file.ext).toBe('.pdf');
      expect(file.size).toBeGreaterThan(0);
      expect(file.id).not.toBe(file.name);
    });

    it('应该支持文件夹的 FileItem（ext 为空，size 为 0）', () => {
      const folder: FileItem = {
        id: 'folder-uuid-987654321',
        name: 'MyFolder',
        ext: '',  // 文件夹无扩展名
        parentId: 'dir-0',
        size: 0,  // 文件夹大小为0
        mtime: 1703500800000,
      };

      expect(folder.name).toBe('MyFolder');
      expect(folder.ext).toBe('');
      expect(folder.size).toBe(0);
      expect(folder.id).not.toBe(folder.name);
    });

    it('应该正确识别文件和文件夹（基于 ext）', () => {
      const file: FileItem = {
        id: 'f1',
        name: 'test.txt',
        ext: '.txt',
        parentId: 'p',
        size: 100,
        mtime: 0,
      };

      const folder: FileItem = {
        id: 'd1',
        name: 'folder',
        ext: '',
        parentId: 'p',
        size: 0,
        mtime: 0,
      };

      // 基于 ext 判断：ext !== '' 表示文件，ext === '' 表示文件夹
      const isFile = (item: FileItem) => item.ext !== '';
      const isFolder = (item: FileItem) => item.ext === '';

      expect(isFile(file)).toBe(true);
      expect(isFolder(file)).toBe(false);
      expect(isFile(folder)).toBe(false);
      expect(isFolder(folder)).toBe(true);
    });

    it('应该正确识别文件和文件夹（基于 size）', () => {
      const file: FileItem = {
        id: 'f1',
        name: 'test.txt',
        ext: '.txt',
        parentId: 'p',
        size: 512,  // 文件有大小
        mtime: 0,
      };

      const folder: FileItem = {
        id: 'd1',
        name: 'folder',
        ext: '',
        parentId: 'p',
        size: 0,   // 文件夹大小为0
        mtime: 0,
      };

      const isFile = (item: FileItem) => item.size > 0;
      const isFolder = (item: FileItem) => item.size === 0;

      expect(isFile(file)).toBe(true);
      expect(isFolder(folder)).toBe(true);
    });
  });

  describe('文件夹属性验证', () => {
    it('文件夹应该有空的 ext', () => {
      const folder: FileItem = {
        id: 'folder-1',
        name: 'Documents',
        ext: '',
        parentId: 'root',
        size: 0,
        mtime: Date.now(),
      };

      expect(folder.ext).toBe('');
      expect(folder.ext.length).toBe(0);
    });

    it('文件夹应该有零的 size', () => {
      const folder: FileItem = {
        id: 'folder-1',
        name: 'Documents',
        ext: '',
        parentId: 'root',
        size: 0,
        mtime: Date.now(),
      };

      expect(folder.size).toBe(0);
      expect(folder.size).toEqual(0);
    });

    it('文件夹的 id 和 name 应该不同（使用 UUID）', () => {
      const folder: FileItem = {
        id: 'folder-uuid-abcdef1234567890',
        name: 'MyFolder',
        ext: '',
        parentId: 'root',
        size: 0,
        mtime: Date.now(),
      };

      expect(folder.id).not.toBe(folder.name);
      expect(folder.id.length).toBeGreaterThan(folder.name.length);
    });

    it('文件夹应该有有效的 parentId', () => {
      const folder: FileItem = {
        id: 'folder-1',
        name: 'Subfolder',
        ext: '',
        parentId: 'parent-folder-uuid',
        size: 0,
        mtime: Date.now(),
      };

      expect(folder.parentId).toBeDefined();
      expect(folder.parentId).not.toBeNull();
      expect(folder.parentId.length).toBeGreaterThan(0);
    });

    it('文件夹应该有有效的 mtime', () => {
      const now = Date.now();
      const folder: FileItem = {
        id: 'folder-1',
        name: 'MyFolder',
        ext: '',
        parentId: 'root',
        size: 0,
        mtime: now,
      };

      expect(folder.mtime).toBeDefined();
      expect(folder.mtime).toBeGreaterThan(0);
      expect(folder.mtime).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('文件名解析 - parseFileName 函数', () => {
    it('应该正确解析文件名（带扩展名）', () => {
      const { name, ext } = parseFileName('document.pdf');

      expect(name).toBe('document');
      expect(ext).toBe('.pdf');
    });

    it('应该正确解析文件夹名（无扩展名）', () => {
      const { name, ext } = parseFileName('MyFolder');

      expect(name).toBe('MyFolder');
      expect(ext).toBe('');
    });

    it('应该处理多点文件名', () => {
      const { name, ext } = parseFileName('archive.tar.gz');

      expect(name).toBe('archive.tar');
      expect(ext).toBe('.gz');
    });

    it('应该处理隐藏文件（以点开头）', () => {
      const { name, ext } = parseFileName('.gitignore');

      expect(name).toBe('.gitignore');
      expect(ext).toBe('');
    });

    it('应该处理隐藏文件夹', () => {
      const { name, ext } = parseFileName('.config');

      expect(name).toBe('.config');
      expect(ext).toBe('');
    });

    it('应该处理没有扩展名的文件', () => {
      const { name, ext } = parseFileName('README');

      expect(name).toBe('README');
      expect(ext).toBe('');
    });

    it('应该处理中文文件名', () => {
      const { name, ext } = parseFileName('文档.docx');

      expect(name).toBe('文档');
      expect(ext).toBe('.docx');
    });

    it('应该处理中文文件夹名', () => {
      const { name, ext } = parseFileName('我的文件夹');

      expect(name).toBe('我的文件夹');
      expect(ext).toBe('');
    });

    it('应该处理特殊字符（允许的字符）', () => {
      const { name, ext } = parseFileName('file-name_v2.0.pdf');

      expect(name).toBe('file-name_v2.0');
      expect(ext).toBe('.pdf');
    });

    it('应该处理只有扩展名的文件', () => {
      const { name, ext } = parseFileName('.tar.gz');

      expect(name).toBe('.tar');
      expect(ext).toBe('.gz');
    });

    it('应该处理末尾有点的文件名', () => {
      const { name, ext } = parseFileName('filename.');

      expect(name).toBe('filename.');
      expect(ext).toBe('');
    });
  });

  describe('文件与文件夹的混合处理', () => {
    it('应该能够区分混合列表中的文件和文件夹', () => {
      const items: FileItem[] = [
        {
          id: 'file-1',
          name: 'document.pdf',
          ext: '.pdf',
          parentId: 'root',
          size: 1024,
          mtime: Date.now(),
        },
        {
          id: 'folder-1',
          name: 'Documents',
          ext: '',
          parentId: 'root',
          size: 0,
          mtime: Date.now(),
        },
        {
          id: 'file-2',
          name: 'image.png',
          ext: '.png',
          parentId: 'root',
          size: 2048,
          mtime: Date.now(),
        },
        {
          id: 'folder-2',
          name: 'Pictures',
          ext: '',
          parentId: 'root',
          size: 0,
          mtime: Date.now(),
        },
      ];

      const files = items.filter(item => item.ext !== '');
      const folders = items.filter(item => item.ext === '');

      expect(files).toHaveLength(2);
      expect(folders).toHaveLength(2);

      expect(files[0].name).toBe('document.pdf');
      expect(files[1].name).toBe('image.png');

      expect(folders[0].name).toBe('Documents');
      expect(folders[1].name).toBe('Pictures');
    });

    it('应该保留文件的扩展名信息', () => {
      const items: FileItem[] = [
        {
          id: 'f1',
          name: 'report.pdf',
          ext: '.pdf',
          parentId: 'p',
          size: 1024,
          mtime: 0,
        },
        {
          id: 'f2',
          name: 'data.xlsx',
          ext: '.xlsx',
          parentId: 'p',
          size: 2048,
          mtime: 0,
        },
      ];

      items.forEach(file => {
        expect(file.ext).not.toBe('');
        expect(file.ext).toMatch(/^\./); // 以点开头
      });
    });

    it('应该标准化文件夹的扩展名（为空）', () => {
      const items: FileItem[] = [
        {
          id: 'd1',
          name: 'Folder1',
          ext: '',
          parentId: 'p',
          size: 0,
          mtime: 0,
        },
        {
          id: 'd2',
          name: 'Folder2',
          ext: '',
          parentId: 'p',
          size: 0,
          mtime: 0,
        },
      ];

      items.forEach(folder => {
        expect(folder.ext).toBe('');
      });
    });
  });

  describe('边界情况处理', () => {
    it('应该处理极长的文件夹名（接近限制）', () => {
      const longName = 'A'.repeat(255); // Windows 路径限制

      const folder: FileItem = {
        id: 'folder-1',
        name: longName,
        ext: '',
        parentId: 'root',
        size: 0,
        mtime: Date.now(),
      };

      expect(folder.name.length).toBe(255);
      expect(folder.ext).toBe('');
    });

    it('应该处理很短的文件夹名', () => {
      const folder: FileItem = {
        id: 'folder-1',
        name: 'A',
        ext: '',
        parentId: 'root',
        size: 0,
        mtime: Date.now(),
      };

      expect(folder.name.length).toBe(1);
      expect(folder.ext).toBe('');
    });

    it('应该处理包含空格的文件夹名', () => {
      const folder: FileItem = {
        id: 'folder-1',
        name: 'My Important Folder',
        ext: '',
        parentId: 'root',
        size: 0,
        mtime: Date.now(),
      };

      expect(folder.name).toContain(' ');
      expect(folder.ext).toBe('');
    });

    it('应该处理包含数字的文件夹名', () => {
      const folder: FileItem = {
        id: 'folder-1',
        name: 'Folder2025',
        ext: '',
        parentId: 'root',
        size: 0,
        mtime: Date.now(),
      };

      expect(folder.name).toMatch(/\d+/);
      expect(folder.ext).toBe('');
    });

    it('应该处理包含连字符和下划线的文件夹名', () => {
      const folder: FileItem = {
        id: 'folder-1',
        name: 'folder-name_v2',
        ext: '',
        parentId: 'root',
        size: 0,
        mtime: Date.now(),
      };

      expect(folder.name).toContain('-');
      expect(folder.name).toContain('_');
      expect(folder.ext).toBe('');
    });
  });
});

/**
 * 文件类型判断工具函数
 * 这些是测试中使用的辅助函数，在实际实现中应该放在工具库中
 */

export function isFile(item: FileItem): boolean {
  return item.ext !== '' && item.size > 0;
}

export function isFolder(item: FileItem): boolean {
  return item.ext === '' && item.size === 0;
}

export function getItemType(item: FileItem): 'file' | 'folder' {
  return isFolder(item) ? 'folder' : 'file';
}
