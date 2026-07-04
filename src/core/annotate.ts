import type { JpToken } from './tokenizer';
import { classifyPitch, type PitchPattern } from './pitch';
import { furigana } from './furigana';
import { katakanaToHiragana } from './kana';

export interface RenderToken {
  surface: string;
  ruby: string | null;
  pattern: PitchPattern;
  basicForm: string;
  reading?: string;
}

export function buildRenderTokens(
  tokens: JpToken[],
  accents: (number | null)[],
): RenderToken[] {
  return tokens.map((t, i) => {
    const reading = t.reading ? katakanaToHiragana(t.reading) : undefined;
    const accent = accents[i] ?? null;
    return {
      surface: t.surface,
      ruby: furigana(t.surface, t.reading).ruby,
      pattern: reading ? classifyPitch(reading, accent) : 'unknown',
      basicForm: t.basicForm,
      reading,
    };
  });
}
