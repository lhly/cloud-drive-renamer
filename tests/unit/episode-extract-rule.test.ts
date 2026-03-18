import { describe, it, expect } from 'vitest';
import { EpisodeExtractRule } from '../../src/rules/episode-extract';

describe('EpisodeExtractRule', () => {
  it('应按模板输出剧集命名（含 ext）', () => {
    const rule = new EpisodeExtractRule({
      template: '{prefix}.S{season}E{episode}{ext}',
      prefix: 'My.Show',
      season: 1,
      leadingZeroCount: 3,
    });

    const result = rule.execute('My.Show.S01E02.1080p.mp4', 0, 1);
    expect(result).toBe('My.Show.S01E002.mp4');
  });

  it('模板未包含 {ext} 时应自动补扩展名', () => {
    const rule = new EpisodeExtractRule({
      template: '{prefix}.S{season}E{episode}',
      prefix: 'Series',
      season: 2,
      leadingZeroCount: 2,
    });

    const result = rule.execute('Series.EP7.mkv', 0, 1);
    expect(result).toBe('Series.S02E07.mkv');
  });

  it('应支持 helperPre/helperPost 提取集数', () => {
    const rule = new EpisodeExtractRule({
      template: '{prefix}-S{season}E{episode}{ext}',
      prefix: 'Drama',
      season: 3,
      helperPre: '第',
      helperPost: '集',
      leadingZeroCount: 3,
    });

    const result = rule.execute('Drama 第12集 中文字幕.mp4', 0, 1);
    expect(result).toBe('Drama-S03E012.mp4');
  });

  it('应支持 offset 偏移', () => {
    const rule = new EpisodeExtractRule({
      template: '{prefix}.S{season}E{episode}{ext}',
      prefix: 'Offset',
      season: 1,
      offset: 10,
      leadingZeroCount: 3,
    });

    const result = rule.execute('Offset EP02.mp4', 0, 1);
    expect(result).toBe('Offset.S01E012.mp4');
  });

  it('提取失败时应抛出“未识别到集数”错误码，供上层展示友好文案', () => {
    const rule = new EpisodeExtractRule({
      template: '{prefix}.S{season}E{episode}{ext}',
      prefix: 'NoEp',
      season: 1,
    });

    expect(() => rule.execute('No episode token here.mp4', 0, 1)).toThrow(
      /extract_episode_not_found/
    );
  });

  it('offset 导致集数无效时应抛出范围错误码', () => {
    const rule = new EpisodeExtractRule({
      template: '{prefix}.S{season}E{episode}{ext}',
      prefix: 'OffsetBad',
      season: 1,
      offset: -10,
      leadingZeroCount: 3,
    });

    expect(() => rule.execute('OffsetBad EP02.mp4', 0, 1)).toThrow(
      /extract_episode_out_of_range/
    );
  });
});
