import { RuleExecutor, EpisodeExtractRuleParams } from '../types/rule';
import { parseFileName } from '../utils/helpers';

const SeasonEpisodeExtract = /S(?:eason)?[._\- ]?(\d{1,3})(?:[._\- ]?E(?:pisode)?|[._\- ])(\d{1,3})(?!\d)/i;
const EpisodeExtract1 = /EP?(\d{1,3})(?!\d)/i;
const EpisodeExtract2 = /(?:^|[^0-9h\u4E00-\u9FA5])(\d{1,3})(?!\d)(?![PK季])/i;
const EpisodeExtract3 = /(?:^|[^0-9h])(\d{1,3})(?!\d)(?![PK季])/i;

/**
 * 剧集提取规则
 *
 * 从文件名中提取集数并按模板生成新文件名。
 * 支持模板变量：{prefix} {season} {episode} {ext}
 */
export class EpisodeExtractRule implements RuleExecutor {
  private config: Required<Omit<EpisodeExtractRuleParams, 'season' | 'offset' | 'leadingZeroCount' | 'helperPre' | 'helperPost'>> & {
    season: number | string;
    offset: number | string;
    leadingZeroCount: number;
    helperPre: string;
    helperPost: string;
  };

  constructor(params: EpisodeExtractRuleParams) {
    if (!this.validate(params)) {
      throw new Error('Invalid rule configuration');
    }

    this.config = {
      template: params.template,
      prefix: params.prefix,
      season: params.season ?? 1,
      offset: params.offset ?? 0,
      leadingZeroCount: params.leadingZeroCount ?? 3,
      helperPre: params.helperPre ?? '',
      helperPost: params.helperPost ?? '',
    };
  }

  execute(fileName: string, _index: number, _total: number): string {
    const { name, ext } = parseFileName(fileName);

    const leadingZeroCount = this.normalizeLeadingZeroCount(this.config.leadingZeroCount);
    const season = this.normalizeSeason(this.config.season);

    const extracted = this.extractEpisode(name, leadingZeroCount);
    if (!extracted) {
      throw new Error('extract_episode_not_found');
    }

    const offset = this.normalizeOffset(this.config.offset);
    const shiftedEpisode = extracted + offset;
    if (!Number.isInteger(shiftedEpisode) || shiftedEpisode <= 0) {
      throw new Error('extract_episode_out_of_range');
    }

    const episode = String(shiftedEpisode).padStart(leadingZeroCount, '0');

    let output = this.applyTemplate(this.config.template, {
      prefix: this.config.prefix,
      season,
      episode,
      ext,
    });

    if (!this.config.template.includes('{ext}') && ext) {
      output += ext;
    }

    if (!output.trim()) {
      throw new Error('extract_template_empty');
    }

    return output;
  }

  validate(config: any): boolean {
    if (typeof config !== 'object' || config === null) {
      return false;
    }

    if (typeof config.template !== 'string' || config.template.trim().length === 0) {
      return false;
    }

    if (typeof config.prefix !== 'string') {
      return false;
    }

    if ('helperPre' in config && typeof config.helperPre !== 'string') {
      return false;
    }

    if ('helperPost' in config && typeof config.helperPost !== 'string') {
      return false;
    }

    if ('leadingZeroCount' in config && !Number.isFinite(Number(config.leadingZeroCount))) {
      return false;
    }

    return true;
  }

  private applyTemplate(
    template: string,
    values: { prefix: string; season: string; episode: string; ext: string }
  ): string {
    return template
      .split('{prefix}').join(values.prefix)
      .split('{season}').join(values.season)
      .split('{episode}').join(values.episode)
      .split('{ext}').join(values.ext);
  }

  private normalizeSeason(raw: number | string): string {
    const parsed = Number.parseInt(String(raw ?? ''), 10);
    const season = Number.isInteger(parsed) && parsed > 0 && parsed <= 99 ? parsed : 1;
    return String(season).padStart(2, '0');
  }

  private normalizeLeadingZeroCount(raw: number): number {
    const parsed = Number.isFinite(raw) ? Math.trunc(raw) : Number.parseInt(String(raw), 10);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10) {
      return 3;
    }
    return parsed;
  }

  private normalizeOffset(raw: number | string): number {
    if (raw === '' || raw === null || raw === undefined) {
      return 0;
    }
    const parsed = Number.parseInt(String(raw), 10);
    return Number.isInteger(parsed) ? parsed : 0;
  }

  private extractEpisode(name: string, leadingZeroCount: number): number | null {
    const fromHelpers = this.extractEpisodeByHelpers(name, leadingZeroCount);
    if (fromHelpers !== null) {
      return fromHelpers;
    }

    const fromSeasonEpisode = this.extractByRegex(name, SeasonEpisodeExtract, 2, leadingZeroCount);
    if (fromSeasonEpisode !== null) {
      return fromSeasonEpisode;
    }

    const fromEP = this.extractByRegex(name, EpisodeExtract1, 1, leadingZeroCount);
    if (fromEP !== null) {
      return fromEP;
    }

    const fromGeneric1 = this.extractByRegex(name, EpisodeExtract2, 1, leadingZeroCount);
    if (fromGeneric1 !== null) {
      return fromGeneric1;
    }

    const fromGeneric2 = this.extractByRegex(name, EpisodeExtract3, 1, leadingZeroCount);
    if (fromGeneric2 !== null) {
      return fromGeneric2;
    }

    return null;
  }

  private extractEpisodeByHelpers(name: string, leadingZeroCount: number): number | null {
    const pre = this.config.helperPre;
    const post = this.config.helperPost;

    if (!pre && !post) {
      return null;
    }

    const preIndex = pre ? name.indexOf(pre) : 0;
    if (pre && preIndex === -1) {
      return null;
    }

    const postIndex = post ? name.lastIndexOf(post) : name.length;
    if (post && postIndex === -1) {
      return null;
    }

    const start = pre ? preIndex + pre.length : 0;
    const end = post ? postIndex : name.length;

    if (end <= start) {
      return null;
    }

    const segment = name.slice(start, end);
    return this.extractByRegex(segment, EpisodeExtract1, 1, leadingZeroCount)
      ?? this.extractByRegex(segment, EpisodeExtract2, 1, leadingZeroCount)
      ?? this.extractByRegex(segment, EpisodeExtract3, 1, leadingZeroCount);
  }

  private extractByRegex(
    input: string,
    pattern: RegExp,
    groupIndex: number,
    _leadingZeroCount: number
  ): number | null {
    const match = input.match(pattern);
    if (!match || !match[groupIndex]) {
      return null;
    }

    const parsed = Number.parseInt(match[groupIndex], 10);
    if (!Number.isInteger(parsed) || parsed <= 0 || parsed >= 1000) {
      return null;
    }

    return parsed;
  }
}
