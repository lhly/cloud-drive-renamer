import type { RuleConfig } from './rule';

export type RulePresetSource = 'recent' | 'template';

export interface RulePresetRecord {
  id: string;
  name?: string;
  config: RuleConfig;
  createdAt: number;
  updatedAt: number;
  source: RulePresetSource;
}

export type EpisodeExtractFillTarget = 'prefix' | 'helperPre' | 'helperPost';

export type EpisodeExtractFillMode = 'full-name' | 'segment';

export interface EpisodeExtractAssistState {
  sampleFileId: string | null;
  sampleFileName: string | null;
  fillTarget: EpisodeExtractFillTarget;
  fillMode: EpisodeExtractFillMode;
  suggestedFailureFileId: string | null;
}

export const DEFAULT_EPISODE_EXTRACT_ASSIST_STATE: EpisodeExtractAssistState = {
  sampleFileId: null,
  sampleFileName: null,
  fillTarget: 'prefix',
  fillMode: 'full-name',
  suggestedFailureFileId: null,
};
