import { describe, it, expect } from 'vitest';
import { ReplaceRule } from '../../src/rules/replace';
import { NumberingRule } from '../../src/rules/numbering';
import { RuleFactory } from '../../src/rules/rule-factory';

describe('ReplaceRule', () => {
  it('should replace text in file name', () => {
    const rule = new ReplaceRule({
      search: 'old',
      replace: 'new',
      caseSensitive: false,
      global: false,
    });

    const result = rule.execute('old_file.txt', 0, 1);
    expect(result).toBe('new_file.txt');
  });

  it('should replace all occurrences when global is true', () => {
    const rule = new ReplaceRule({
      search: 'a',
      replace: 'b',
      caseSensitive: false,
      global: true,
    });

    const result = rule.execute('aaa.txt', 0, 1);
    expect(result).toBe('bbb.txt');
  });

  it('should be case sensitive', () => {
    const rule = new ReplaceRule({
      search: 'OLD',
      replace: 'new',
      caseSensitive: true,
      global: false,
    });

    const result = rule.execute('old_file.txt', 0, 1);
    expect(result).toBe('old_file.txt');
  });
});

describe('NumberingRule', () => {
  it('should add prefix numbering', () => {
    const rule = new NumberingRule({
      startNumber: 1,
      digits: 3,
      position: 'prefix',
      format: '{num}',
      separator: '_',
    });

    const result = rule.execute('file.txt', 0, 10);
    expect(result).toBe('001_file.txt');
  });

  it('should add suffix numbering', () => {
    const rule = new NumberingRule({
      startNumber: 1,
      digits: 2,
      position: 'suffix',
      format: 'E{num}',
      separator: '_',
    });

    const result = rule.execute('video.mp4', 4, 10);
    expect(result).toBe('video_E05.mp4');
  });

  it('should handle custom format', () => {
    const rule = new NumberingRule({
      startNumber: 1,
      digits: 2,
      position: 'prefix',
      format: '第{num}集',
      separator: '-',
    });

    const result = rule.execute('剧集.mp4', 0, 10);
    expect(result).toBe('第01集-剧集.mp4');
  });
});

describe('RuleFactory', () => {
  it('should create replace rule', () => {
    const rule = RuleFactory.create({
      type: 'replace',
      params: {
        search: 'old',
        replace: 'new',
      },
    });

    expect(rule).toBeInstanceOf(ReplaceRule);
  });

  it('should create numbering rule', () => {
    const rule = RuleFactory.create({
      type: 'numbering',
      params: {
        startNumber: 1,
        digits: 3,
        position: 'prefix',
        format: '{num}',
        separator: '_',
      },
    });

    expect(rule).toBeInstanceOf(NumberingRule);
  });

  it('should throw error for unknown rule type', () => {
    expect(() =>
      RuleFactory.create({
        type: 'unknown' as any,
        params: {},
      })
    ).toThrow();
  });
});
