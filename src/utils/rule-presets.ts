import { RuleFactory } from '../rules/rule-factory';
import type { RuleConfig } from '../types/rule';
import type { RulePresetRecord } from '../types/rule-preset';
import { storage } from './storage';

const RECENT_RULE_PRESETS_KEY = 'rulePresets.recent';
const TEMPLATE_RULE_PRESETS_KEY = 'rulePresets.templates';
const MAX_RECENT_RULE_PRESETS = 8;

function normalizeConfig(config: RuleConfig): string {
  return JSON.stringify(config);
}

function isRuleConfigShape(value: unknown): value is RuleConfig {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    'params' in value
  );
}

function sanitizeRecords(records: unknown, source: RulePresetRecord['source']): RulePresetRecord[] {
  if (!Array.isArray(records)) {
    return [];
  }

  return records
    .filter((record): record is RulePresetRecord => {
      if (typeof record !== 'object' || record === null) return false;
      const candidate = record as Partial<RulePresetRecord>;
      return (
        typeof candidate.id === 'string' &&
        isRuleConfigShape(candidate.config) &&
        typeof candidate.createdAt === 'number' &&
        typeof candidate.updatedAt === 'number'
      );
    })
    .map((record) => ({
      ...record,
      source,
    }))
    .filter((record) => (record.source === 'template' ? Boolean(record.name?.trim()) : true));
}

export function createRulePresetId(): string {
  return `rule-preset-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isRulePresetConfigValid(config: RuleConfig): boolean {
  try {
    RuleFactory.create(config);
    return true;
  } catch {
    return false;
  }
}

export function buildRulePresetSummary(config: RuleConfig): string {
  switch (config.type) {
    case 'replace':
      return `Replace: ${String(config.params.search || '')} → ${String(config.params.replace || '')}`;
    case 'regex':
      return `Regex: ${String(config.params.pattern || '')}`;
    case 'prefix':
      return `Prefix: ${String(config.params.prefix || '')}`;
    case 'suffix':
      return `Suffix: ${String(config.params.suffix || '')}`;
    case 'numbering':
      return `Numbering: ${String(config.params.format || '{num}')}`;
    case 'sanitize':
      return `Sanitize: ${String(config.params.removeChars || '') || 'illegal chars'}`;
    case 'episodeExtract':
      return `Episode: ${String(config.params.template || '{prefix}.S{season}E{episode}{ext}')}`;
    default:
      return config.type;
  }
}

export async function getRecentRulePresets(): Promise<RulePresetRecord[]> {
  const records = await storage.get<unknown>(RECENT_RULE_PRESETS_KEY);
  return sanitizeRecords(records, 'recent').slice(0, MAX_RECENT_RULE_PRESETS);
}

export async function getTemplateRulePresets(): Promise<RulePresetRecord[]> {
  const records = await storage.get<unknown>(TEMPLATE_RULE_PRESETS_KEY);
  return sanitizeRecords(records, 'template');
}

export async function recordRecentRulePreset(config: RuleConfig): Promise<RulePresetRecord[]> {
  const nextConfigKey = normalizeConfig(config);
  const existing = await getRecentRulePresets();
  const now = Date.now();
  const duplicate = existing.find((record) => normalizeConfig(record.config) === nextConfigKey);

  const nextRecord: RulePresetRecord = duplicate
    ? {
        ...duplicate,
        config,
        updatedAt: now,
        source: 'recent',
      }
    : {
        id: createRulePresetId(),
        config,
        createdAt: now,
        updatedAt: now,
        source: 'recent',
      };

  const next = [nextRecord, ...existing.filter((record) => record.id !== duplicate?.id)].slice(
    0,
    MAX_RECENT_RULE_PRESETS
  );

  await storage.set(RECENT_RULE_PRESETS_KEY, next);
  return next;
}

export async function saveTemplateRulePreset(
  name: string,
  config: RuleConfig,
  options?: { overwriteId?: string; overwriteName?: boolean }
): Promise<{ records: RulePresetRecord[]; record: RulePresetRecord; replaced: boolean }> {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error('Template name is required');
  }

  const existing = await getTemplateRulePresets();
  const now = Date.now();
  const byId = options?.overwriteId
    ? existing.find((record) => record.id === options.overwriteId) ?? null
    : null;
  const byName = existing.find((record) => record.name === trimmedName) ?? null;

  if (byName && byName.id !== byId?.id && !options?.overwriteName) {
    throw new Error('Template name already exists');
  }

  const target = byId ?? (options?.overwriteName ? byName : null);
  const nextRecord: RulePresetRecord = target
    ? {
        ...target,
        name: trimmedName,
        config,
        updatedAt: now,
        source: 'template',
      }
    : {
        id: createRulePresetId(),
        name: trimmedName,
        config,
        createdAt: now,
        updatedAt: now,
        source: 'template',
      };

  const replaced = Boolean(target);
  const next = [
    nextRecord,
    ...existing.filter(
      (record) => record.id !== target?.id && record.name !== trimmedName
    ),
  ].sort((a, b) => b.updatedAt - a.updatedAt);

  await storage.set(TEMPLATE_RULE_PRESETS_KEY, next);
  return { records: next, record: nextRecord, replaced };
}

export async function deleteTemplateRulePreset(id: string): Promise<RulePresetRecord[]> {
  const existing = await getTemplateRulePresets();
  const next = existing.filter((record) => record.id !== id);
  await storage.set(TEMPLATE_RULE_PRESETS_KEY, next);
  return next;
}

export async function getRulePresetById(id: string): Promise<RulePresetRecord | null> {
  const [recent, templates] = await Promise.all([getRecentRulePresets(), getTemplateRulePresets()]);
  return recent.find((record) => record.id === id) || templates.find((record) => record.id === id) || null;
}

export const RULE_PRESET_STORAGE_KEYS = {
  recent: RECENT_RULE_PRESETS_KEY,
  templates: TEMPLATE_RULE_PRESETS_KEY,
};
