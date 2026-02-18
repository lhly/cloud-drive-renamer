import { describe, it, expect } from 'vitest';
import { buildExecutionPlan } from '../../src/core/execution-plan';
import { checkBatchConflicts, ConflictResolution } from '../../src/core/conflict-detector';

const files = [
  { id: '1', name: 'a.txt', ext: '.txt', parentId: '0', size: 1, mtime: 1 },
  { id: '2', name: 'b.txt', ext: '.txt', parentId: '0', size: 1, mtime: 1 },
];

describe('buildExecutionPlan', () => {
  it('auto-number resolves duplicate names and skips unchanged', () => {
    const newNames = ['same.txt', 'same.txt'];
    const conflicts = checkBatchConflicts(files as any, newNames);

    const plan = buildExecutionPlan({
      files: files as any,
      newNames,
      conflicts,
      resolution: ConflictResolution.AUTO_NUMBER,
    });

    expect(plan.resolvedNames[0]).toMatch(/same\(1\)\.txt/);
    expect(plan.resolvedNames[1]).toMatch(/same\(2\)\.txt/);
    expect(plan.tasks.length).toBe(2);
  });

  it('skip strategy preserves original names', () => {
    const newNames = ['same.txt', 'same.txt'];
    const conflicts = checkBatchConflicts(files as any, newNames);

    const plan = buildExecutionPlan({
      files: files as any,
      newNames,
      conflicts,
      resolution: ConflictResolution.SKIP,
    });

    expect(plan.resolvedNames).toEqual(['a.txt', 'b.txt']);
  });
});
