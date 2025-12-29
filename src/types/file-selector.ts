import { FileItem } from './platform';
import { RuleConfig } from './rule';

/**
 * File type categories for filtering
 */
export type FileType = 'video' | 'image' | 'document' | 'other';

/**
 * Preview item for the preview panel
 * Represents a file with its new name and status
 */
export interface PreviewItem {
  /** Original file information */
  file: FileItem;
  /** New filename after applying rules */
  newName: string;
  /** Whether this filename conflicts with another file */
  conflict: boolean;
  /** Whether this file has been successfully renamed */
  done?: boolean;
  /** Error message if rename failed */
  error?: string;
}

/**
 * Complete state of the file selector panel
 * Used for state management and persistence
 */
export interface FileSelectorState {
  /** All files in the current directory */
  allFiles: FileItem[];
  /** Set of file IDs that are unchecked (reverse storage pattern) */
  uncheckList: Set<string>;
  /** Map of file ID to new filename */
  newNameMap: Map<string, string>;
  /** Set of file IDs with naming conflicts */
  conflictIds: Set<string>;
  /** Current search query */
  searchQuery: string;
  /** Current file type filter */
  typeFilter: FileType | 'all';
  /** Current rule configuration */
  ruleConfig: RuleConfig;
}

/**
 * Events emitted by file selector components
 */
export interface FileSelectorEvents {
  'file-toggle': { fileId: string };
  'select-all': void;
  'deselect-all': void;
  'search': { query: string };
  'type-filter': { type: FileType | 'all' };
  'config-change': RuleConfig;
  'execute': void;
  'panel-close': void;
}
