import { describe, it, expect, vi, afterEach } from 'vitest';
import { analyzeText, type AnalyzeDeps } from '../src/core/analyze';
import { classifyPitch } from '../src/core/pitch';
import type { JpToken } from '../src/core/tokenizer';
import type { TokenQuery } from '../src/core/messages';

const compoundTokens: JpToken[] = [
  { surface: '食肉', basicForm: '食肉', reading: 'ショクニク', pos: '名詞', posDetail: '一般' },
  { surface: '目', basicForm: '目', reading: 'モク', pos: '名詞', posDetail: '接尾' },
  { surface: 'の', basicForm: 'の', reading: 'ノ', pos: '助詞', posDetail: '連体化' },
];

function makeDeps(overrides: Partial<AnalyzeDeps> = {}): AnalyzeDeps {
  return {
    tokenize: async () => compoundTokens,
    findCompounds: async () => ({ 食肉目: 'しょくにくもく' }),
    annotate: async () => ({ accents: [4, null] }),
    ...overrides,
  };
}

afterEach(() => vi.restoreAllMocks());

describe('analyzeText', () => {
  it('merges a compound and annotates it as one token', async () => {
    const annotated: TokenQuery[][] = [];
    const out = await analyzeText(
      '食肉目の',
      makeDeps({
        annotate: async (tokens) => {
          annotated.push(tokens);
          return { accents: [4, null] };
        },
      }),
    );
    expect(annotated).toEqual([
      [
        { basicForm: '食肉目', surface: '食肉目', reading: 'ショクニクモク' },
        { basicForm: 'の', surface: 'の', reading: 'ノ' },
      ],
    ]);
    expect(out[0].pattern).toBe(classifyPitch('しょくにくもく', 4));
    expect(out[0].parts).toHaveLength(2);
    expect(out[1].parts).toBeUndefined();
  });

  it('sends no compound lookup when there are no candidates', async () => {
    const findCompounds = vi.fn(async () => ({}));
    const out = await analyzeText(
      'の',
      makeDeps({ tokenize: async () => [compoundTokens[2]], findCompounds, annotate: async () => ({ accents: [null] }) }),
    );
    expect(findCompounds).not.toHaveBeenCalled();
    expect(out).toHaveLength(1);
  });

  it('annotates unmerged and warns once when the compound lookup fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = new Error('boom');
    const annotated: TokenQuery[][] = [];
    const out = await analyzeText(
      '食肉目の',
      makeDeps({
        findCompounds: async () => {
          throw error;
        },
        annotate: async (tokens) => {
          annotated.push(tokens);
          return { accents: [null, null, null] };
        },
      }),
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('[yabai-jp] compound lookup failed, annotating unmerged', error);
    expect(annotated[0].map((t) => t.surface)).toEqual(['食肉', '目', 'の']);
    expect(out.map((t) => t.surface)).toEqual(['食肉', '目', 'の']);
  });
});
