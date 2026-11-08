import { describe, it, expect } from 'vitest';
import {
  compoundCandidates,
  isCompoundEligible,
  mergeCompounds,
} from '../src/core/compounds';
import type { JpToken } from '../src/core/tokenizer';

const tk = (surface: string, pos: string, posDetail: string, reading?: string): JpToken => ({
  surface,
  basicForm: surface,
  pos,
  posDetail,
  reading,
});

const noun = (surface: string, reading?: string) => tk(surface, '名詞', '一般', reading);

describe('isCompoundEligible', () => {
  it('accepts 名詞 (incl. 接尾) and 接頭詞, rejects 非自立/代名詞/数 and other POS', () => {
    expect(isCompoundEligible(tk('食肉', '名詞', '一般'))).toBe(true);
    expect(isCompoundEligible(tk('目', '名詞', '接尾'))).toBe(true);
    expect(isCompoundEligible(tk('お', '接頭詞', '名詞接続'))).toBe(true);
    expect(isCompoundEligible(tk('こと', '名詞', '非自立'))).toBe(false);
    expect(isCompoundEligible(tk('これ', '名詞', '代名詞'))).toBe(false);
    expect(isCompoundEligible(tk('三', '名詞', '数'))).toBe(false);
    expect(isCompoundEligible(tk('の', '助詞', '連体化'))).toBe(false);
  });
});

describe('compoundCandidates', () => {
  it('lists runs of 2–4 eligible tokens', () => {
    const tokens = [
      noun('食肉'),
      tk('目', '名詞', '接尾'),
      tk('の', '助詞', '連体化'),
      noun('動物'),
    ];
    expect(compoundCandidates(tokens)).toEqual(['食肉目']);
    const run = ['a', 'b', 'c', 'd', 'e'].map((s) => noun(s));
    const candidates = compoundCandidates(run);
    expect(candidates).toContain('abcd');
    expect(candidates).not.toContain('abcde');
  });

  it('returns [] when no two eligible tokens are adjacent', () => {
    const tokens = [noun('猫'), tk('の', '助詞', '連体化'), noun('犬')];
    expect(compoundCandidates(tokens)).toEqual([]);
  });
});

describe('mergeCompounds', () => {
  it('merges a found candidate with the JMdict reading and parts', () => {
    const tokens = [
      noun('食肉', 'ショクニク'),
      tk('目', '名詞', '接尾', 'メ'),
      tk('の', '助詞', '連体化', 'ノ'),
      noun('動物', 'ドウブツ'),
    ];
    const merged = mergeCompounds(tokens, { 食肉目: 'しょくにくもく' });
    expect(merged.map((t) => t.surface)).toEqual(['食肉目', 'の', '動物']);
    expect(merged[0]).toEqual({
      surface: '食肉目',
      basicForm: '食肉目',
      reading: 'ショクニクモク',
      pos: '名詞',
      posDetail: '複合',
      parts: [
        { surface: '食肉', basicForm: '食肉', reading: 'ショクニク' },
        { surface: '目', basicForm: '目', reading: 'メ' },
      ],
    });
  });

  it('prefers the longest match', () => {
    const tokens = [noun('A'), noun('B'), noun('C')];
    const merged = mergeCompounds(tokens, { AB: 'ab', ABC: 'abc' });
    expect(merged.map((t) => t.surface)).toEqual(['ABC']);
  });

  it('overlapping matches never reuse a token', () => {
    const tokens = [noun('A'), noun('B'), noun('C')];
    const merged = mergeCompounds(tokens, { AB: 'ab', BC: 'bc' });
    expect(merged.map((t) => t.surface)).toEqual(['AB', 'C']);
  });

  it('leaves tokens unchanged when nothing is found', () => {
    const tokens = [noun('猫', 'ネコ'), noun('犬', 'イヌ')];
    expect(mergeCompounds(tokens, {})).toEqual(tokens);
  });
});
