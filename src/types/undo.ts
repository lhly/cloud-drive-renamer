import { PlatformName } from './platform';

export interface UndoRenameItem {
  fileId: string;
  original: string;
  renamed: string;
  index: number;
}

export interface LastRenameOperation {
  platform: PlatformName;
  directoryKey: string;
  createdAt: number;
  updatedAt: number;
  items: UndoRenameItem[];
}
