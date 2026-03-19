import { FileItem } from '../types/platform';
import { Task } from '../types/core';
import {
  ConflictResolution,
  ConflictResult,
  resolveBatchConflicts,
} from './conflict-detector';

export interface ExecutionPlanInput {
  files: FileItem[];
  newNames: string[];
  conflicts?: Map<string, ConflictResult>;
  resolution?: ConflictResolution | null;
  skipUnchanged?: boolean;
}

export interface ExecutionPlanResult {
  resolvedNames: string[];
  tasks: Task[];
  skippedIndexes: number[];
}

export function buildExecutionPlan({
  files,
  newNames,
  conflicts,
  resolution,
  skipUnchanged = true,
}: ExecutionPlanInput): ExecutionPlanResult {
  if (files.length !== newNames.length) {
    throw new Error('Files and newNames length mismatch');
  }

  const conflictMap = conflicts ?? new Map<string, ConflictResult>();

  let resolvedNames = newNames.slice();

  if (resolution && conflictMap.size > 0) {
    switch (resolution) {
      case ConflictResolution.AUTO_NUMBER:
        resolvedNames = resolveBatchConflicts(files, newNames, conflictMap);
        break;
      case ConflictResolution.SKIP:
        resolvedNames = newNames.map((name, index) => {
          const file = files[index];
          const conflict = conflictMap.get(file.id);
          return conflict?.hasConflict ? file.name : name;
        });
        break;
      default:
        resolvedNames = newNames.slice();
        break;
    }
  }

  const tasks: Task[] = [];
  const skippedIndexes: number[] = [];

  resolvedNames.forEach((resolvedName, index) => {
    const file = files[index];
    if (skipUnchanged && resolvedName === file.name) {
      skippedIndexes.push(index);
      return;
    }

    tasks.push({
      file,
      newName: resolvedName,
      index,
    });
  });

  return { resolvedNames, tasks, skippedIndexes };
}
