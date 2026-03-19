import { describe, expect, it } from 'vitest';
import {
  buildConflictDetails,
  ConflictResolution,
  ConflictType,
} from '../../src/core/conflict-detector';
import type { FileItem } from '../../src/types/platform';

const files: FileItem[] = [
  { id: '1', name: 'old-a.txt', ext: '.txt', parentId: 'root', size: 1, mtime: 1 },
  { id: '2', name: 'old-b.txt', ext: '.txt', parentId: 'root', size: 1, mtime: 1 },
  { id: '3', name: 'old-c.txt', ext: '.txt', parentId: 'root', size: 1, mtime: 1 },
];

describe('conflict-detector helpers', () => {
  it('builds conflict detail rows for duplicate and existing-name conflicts', () => {
    const newNames = ['same.txt', 'same.txt', 'taken.txt'];
    const conflicts = new Map([
      [
        '1',
        {
          type: ConflictType.DUPLICATE_IN_BATCH,
          hasConflict: true,
          conflictingName: 'same.txt',
          conflictingFiles: ['old-a.txt', 'old-b.txt'],
        },
      ],
      [
        '2',
        {
          type: ConflictType.DUPLICATE_IN_BATCH,
          hasConflict: true,
          conflictingName: 'same.txt',
          conflictingFiles: ['old-a.txt', 'old-b.txt'],
        },
      ],
      [
        '3',
        {
          type: ConflictType.NAME_EXISTS,
          hasConflict: true,
          conflictingName: 'taken.txt',
        },
      ],
    ]);

    expect(buildConflictDetails(files, newNames, conflicts)).toEqual([
      {
        fileId: '1',
        originalName: 'old-a.txt',
        targetName: 'same.txt',
        type: ConflictType.DUPLICATE_IN_BATCH,
        conflictingFiles: ['old-a.txt', 'old-b.txt'],
      },
      {
        fileId: '2',
        originalName: 'old-b.txt',
        targetName: 'same.txt',
        type: ConflictType.DUPLICATE_IN_BATCH,
        conflictingFiles: ['old-a.txt', 'old-b.txt'],
      },
      {
        fileId: '3',
        originalName: 'old-c.txt',
        targetName: 'taken.txt',
        type: ConflictType.NAME_EXISTS,
        conflictingFiles: [],
      },
    ]);
  });

  it('exposes only auto-number and skip as executable conflict strategies', () => {
    expect(Object.values(ConflictResolution)).toEqual([
      ConflictResolution.AUTO_NUMBER,
      ConflictResolution.SKIP,
    ]);
  });
});
