import { describe, expect, it } from 'vitest';
import {
  createLastRenameOperation,
  isLastRenameOperationInScope,
  mergeLastRenameOperation,
  retainFailedUndoItems,
} from '../../src/core/last-rename-operation';

describe('last rename operation helpers', () => {
  it('creates a last rename operation from success results', () => {
    const operation = createLastRenameOperation('quark', 'dir-1', [
      { fileId: '1', original: 'old-a.txt', renamed: 'new-a.txt', index: 0 },
    ]);

    expect(operation).not.toBeNull();
    expect(operation?.platform).toBe('quark');
    expect(operation?.directoryKey).toBe('dir-1');
    expect(operation?.items).toEqual([
      { fileId: '1', original: 'old-a.txt', renamed: 'new-a.txt', index: 0 },
    ]);
    expect(typeof operation?.createdAt).toBe('number');
    expect(typeof operation?.updatedAt).toBe('number');
  });

  it('returns null when creating from empty success results', () => {
    expect(createLastRenameOperation('quark', 'dir-1', [])).toBeNull();
  });

  it('merges retry success items into the existing operation', () => {
    const existing = createLastRenameOperation('quark', 'dir-1', [
      { fileId: '1', original: 'old-a.txt', renamed: 'new-a.txt', index: 0 },
    ]);

    const merged = mergeLastRenameOperation(existing, 'quark', 'dir-1', [
      { fileId: '2', original: 'old-b.txt', renamed: 'new-b.txt', index: 1 },
    ]);

    expect(merged).not.toBeNull();
    expect(merged?.items.map((item) => item.fileId)).toEqual(['1', '2']);
    expect(merged?.createdAt).toBe(existing?.createdAt);
    expect((merged?.updatedAt ?? 0) >= (existing?.updatedAt ?? 0)).toBe(true);
  });

  it('checks whether an operation is still in the current scope', () => {
    const operation = createLastRenameOperation('baidu', '/video/season1', [
      { fileId: '9', original: 'ep01.mkv', renamed: 'S01E01.mkv', index: 0 },
    ]);

    expect(isLastRenameOperationInScope(operation, 'baidu', '/video/season1')).toBe(true);
    expect(isLastRenameOperationInScope(operation, 'baidu', '/video/season2')).toBe(false);
    expect(isLastRenameOperationInScope(operation, 'quark', '/video/season1')).toBe(false);
  });

  it('retains only failed undo items', () => {
    const operation = createLastRenameOperation('quark', 'dir-1', [
      { fileId: '1', original: 'old-a.txt', renamed: 'new-a.txt', index: 0 },
      { fileId: '2', original: 'old-b.txt', renamed: 'new-b.txt', index: 1 },
    ]);

    const next = retainFailedUndoItems(operation, new Set(['2']));

    expect(next?.items).toEqual([
      { fileId: '2', original: 'old-b.txt', renamed: 'new-b.txt', index: 1 },
    ]);
  });

  it('returns null when no failed undo items remain', () => {
    const operation = createLastRenameOperation('quark', 'dir-1', [
      { fileId: '1', original: 'old-a.txt', renamed: 'new-a.txt', index: 0 },
    ]);

    expect(retainFailedUndoItems(operation, new Set())).toBeNull();
  });
});
