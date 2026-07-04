import { hasKanji, katakanaToHiragana } from './kana';

export interface FuriganaToken {
  surface: string;
  ruby: string | null;
}

export function furigana(
  surface: string,
  katakanaReading: string | undefined,
): FuriganaToken {
  if (!katakanaReading || !hasKanji(surface)) {
    return { surface, ruby: null };
  }
  return { surface, ruby: katakanaToHiragana(katakanaReading) };
}
