import { PlatformName } from '../types/platform';
import { LastRenameOperation, UndoRenameItem } from '../types/undo';

type RenameSuccessLike = UndoRenameItem;

export function createLastRenameOperation(
  platform: PlatformName,
  directoryKey: string,
  successItems: RenameSuccessLike[]
): LastRenameOperation | null {
  if (!successItems.length) {
    return null;
  }

  const now = Date.now();

  return {
    platform,
    directoryKey,
    createdAt: now,
    updatedAt: now,
    items: successItems.map((item) => ({ ...item })),
  };
}

export function mergeLastRenameOperation(
  existing: LastRenameOperation | null,
  platform: PlatformName,
  directoryKey: string,
  successItems: RenameSuccessLike[]
): LastRenameOperation | null {
  if (!existing || !successItems.length) {
    return existing;
  }

  if (!isLastRenameOperationInScope(existing, platform, directoryKey)) {
    return existing;
  }

  return {
    ...existing,
    updatedAt: Date.now(),
    items: [...existing.items, ...successItems.map((item) => ({ ...item }))],
  };
}

export function isLastRenameOperationInScope(
  operation: LastRenameOperation | null,
  platform: PlatformName,
  directoryKey: string
): boolean {
  if (!operation) {
    return false;
  }

  return operation.platform === platform && operation.directoryKey === directoryKey;
}

export function retainFailedUndoItems(
  operation: LastRenameOperation | null,
  failedIds: Set<string>
): LastRenameOperation | null {
  if (!operation || failedIds.size === 0) {
    return null;
  }

  const items = operation.items.filter((item) => failedIds.has(item.fileId));

  if (!items.length) {
    return null;
  }

  return {
    ...operation,
    updatedAt: Date.now(),
    items,
  };
}
