import { FileItem, PlatformAdapter } from '../types/platform';
import { logger } from '../utils/logger';

/**
 * 冲突类型
 */
export enum ConflictType {
  NONE = 'none',
  NAME_EXISTS = 'name_exists',
  DUPLICATE_IN_BATCH = 'duplicate_in_batch',
}

/**
 * 冲突检测结果
 */
export interface ConflictResult {
  /** 冲突类型 */
  type: ConflictType;
  /** 是否有冲突 */
  hasConflict: boolean;
  /** 冲突的文件名 */
  conflictingName?: string;
  /** 冲突的文件列表(批量冲突时) */
  conflictingFiles?: string[];
}

/**
 * 冲突解决策略
 */
export enum ConflictResolution {
  /** 自动添加编号 */
  AUTO_NUMBER = 'auto_number',
  /** 跳过冲突文件 */
  SKIP = 'skip',
  /** 强制覆盖 */
  OVERWRITE = 'overwrite',
}

/**
 * 检测单个文件名冲突
 * @param newName 新文件名
 * @param parentId 父目录ID
 * @param adapter 平台适配器
 * @returns 冲突检测结果
 */
export async function checkSingleConflict(
  newName: string,
  parentId: string,
  adapter: PlatformAdapter
): Promise<ConflictResult> {
  try {
    const exists = await adapter.checkNameConflict(newName, parentId);

    if (exists) {
      return {
        type: ConflictType.NAME_EXISTS,
        hasConflict: true,
        conflictingName: newName,
      };
    }

    return {
      type: ConflictType.NONE,
      hasConflict: false,
    };
  } catch (error) {
    logger.error('Failed to check name conflict:', error as Error);
    // 检测失败时保守处理,假设无冲突
    return {
      type: ConflictType.NONE,
      hasConflict: false,
    };
  }
}

/**
 * 检测批量重命名中的内部冲突
 * @param files 文件列表
 * @param newNames 新文件名列表
 * @returns 冲突检测结果映射(文件ID -> 冲突结果)
 */
export function checkBatchConflicts(
  files: FileItem[],
  newNames: string[]
): Map<string, ConflictResult> {
  const results = new Map<string, ConflictResult>();
  const nameCount = new Map<string, number>();
  const nameToFiles = new Map<string, string[]>();

  // 统计每个新文件名出现的次数
  newNames.forEach((name, index) => {
    const count = nameCount.get(name) || 0;
    nameCount.set(name, count + 1);

    const fileList = nameToFiles.get(name) || [];
    fileList.push(files[index].name);
    nameToFiles.set(name, fileList);
  });

  // 检测重复
  files.forEach((file, index) => {
    const newName = newNames[index];
    const count = nameCount.get(newName) || 0;

    if (count > 1) {
      results.set(file.id, {
        type: ConflictType.DUPLICATE_IN_BATCH,
        hasConflict: true,
        conflictingName: newName,
        conflictingFiles: nameToFiles.get(newName),
      });
    } else {
      results.set(file.id, {
        type: ConflictType.NONE,
        hasConflict: false,
      });
    }
  });

  return results;
}

/**
 * 检测批量重命名的所有冲突(包括内部冲突和外部冲突)
 * @param files 文件列表
 * @param newNames 新文件名列表
 * @param adapter 平台适配器
 * @returns 冲突检测结果映射
 */
export async function checkAllConflicts(
  files: FileItem[],
  newNames: string[],
  adapter: PlatformAdapter
): Promise<Map<string, ConflictResult>> {
  // 先检测批量内部冲突
  const batchConflicts = checkBatchConflicts(files, newNames);

  // 再检测每个文件与现有文件的冲突
  const externalConflictPromises = files.map(async (file, index) => {
    const batchConflict = batchConflicts.get(file.id);

    // 如果已经有批量内部冲突,不需要再检测外部冲突
    if (batchConflict?.hasConflict) {
      return { fileId: file.id, result: batchConflict };
    }

    const newName = newNames[index];
    const externalConflict = await checkSingleConflict(newName, file.parentId, adapter);

    return { fileId: file.id, result: externalConflict };
  });

  const externalConflicts = await Promise.all(externalConflictPromises);

  // 合并结果
  const finalResults = new Map<string, ConflictResult>();
  externalConflicts.forEach(({ fileId, result }) => {
    finalResults.set(fileId, result);
  });

  return finalResults;
}

/**
 * 解决冲突:自动添加编号
 * @param baseName 基础文件名
 * @param startNumber 起始编号
 * @returns 带编号的文件名
 */
export function resolveConflictWithNumber(baseName: string, startNumber: number = 1): string {
  const dotIndex = baseName.lastIndexOf('.');
  if (dotIndex === -1) {
    return `${baseName}(${startNumber})`;
  }

  const name = baseName.substring(0, dotIndex);
  const ext = baseName.substring(dotIndex);
  return `${name}(${startNumber})${ext}`;
}

/**
 * 批量解决冲突:为所有冲突文件添加编号
 * @param files 文件列表
 * @param newNames 新文件名列表
 * @param conflicts 冲突检测结果
 * @returns 解决冲突后的新文件名列表
 */
export function resolveBatchConflicts(
  files: FileItem[],
  newNames: string[],
  conflicts: Map<string, ConflictResult>
): string[] {
  const nameCounter = new Map<string, number>();
  const resolvedNames: string[] = [];

  newNames.forEach((newName, index) => {
    const file = files[index];
    const conflict = conflicts.get(file.id);

    if (conflict?.hasConflict) {
      // 获取当前名称的计数器
      const counter = nameCounter.get(newName) || 1;
      nameCounter.set(newName, counter + 1);

      // 添加编号
      const resolvedName = resolveConflictWithNumber(newName, counter);
      resolvedNames.push(resolvedName);

      logger.info('Conflict resolved with numbering', {
        original: newName,
        resolved: resolvedName,
        counter,
      });
    } else {
      resolvedNames.push(newName);
    }
  });

  return resolvedNames;
}

/**
 * 显示冲突解决对话框
 * @param conflictCount 冲突数量
 * @returns 用户选择的解决策略
 */
export function showConflictResolutionDialog(conflictCount: number): ConflictResolution | null {
  const message =
    `检测到 ${conflictCount} 个文件名冲突!\n\n` +
    `请选择处理方式:\n` +
    `1. 自动添加编号(推荐) - 如 file.txt -> file(1).txt\n` +
    `2. 跳过冲突文件 - 保留原文件名\n` +
    `3. 强制覆盖 - 替换同名文件(危险!)\n\n` +
    `输入 1, 2 或 3:`;

  const choice = prompt(message);

  switch (choice) {
    case '1':
      return ConflictResolution.AUTO_NUMBER;
    case '2':
      return ConflictResolution.SKIP;
    case '3': {
      // 强制覆盖需要二次确认
      const confirmed = confirm(
        `警告!强制覆盖将替换同名文件,可能导致数据丢失。\n\n确定要继续吗?`
      );
      return confirmed ? ConflictResolution.OVERWRITE : null;
    }
    default:
      return null;
  }
}

/**
 * 冲突检测管理器
 */
export class ConflictDetector {
  constructor(private adapter: PlatformAdapter) {}

  /**
   * 批量检测冲突
   */
  async detectConflicts(files: FileItem[], newNames: string[]): Promise<Map<string, ConflictResult>> {
    logger.info('Starting conflict detection', {
      fileCount: files.length,
    });

    const conflicts = await checkAllConflicts(files, newNames, this.adapter);

    return conflicts;
  }

  /**
   * 自动解决冲突
   */
  resolveConflicts(
    files: FileItem[],
    newNames: string[],
    conflicts: Map<string, ConflictResult>,
    resolution: ConflictResolution
  ): string[] {
    switch (resolution) {
      case ConflictResolution.AUTO_NUMBER:
        return resolveBatchConflicts(files, newNames, conflicts);

      case ConflictResolution.SKIP:
        // 跳过冲突文件,保留原名
        return newNames.map((newName, index) => {
          const file = files[index];
          const conflict = conflicts.get(file.id);
          return conflict?.hasConflict ? file.name : newName;
        });

      case ConflictResolution.OVERWRITE:
        // 强制覆盖,不做修改
        return newNames;

      default:
        return newNames;
    }
  }
}
