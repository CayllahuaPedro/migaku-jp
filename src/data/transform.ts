import type { DictEntry, PitchMap, PosTagMap } from '../core/types';

interface RawWord {
  id: string;
  kanji: { text: string }[];
  kana: { text: string }[];
  sense: { partOfSpeech: string[]; gloss: { text: string }[] }[];
}

export function transformJmdict(words: RawWord[]): DictEntry[] {
  return words.map((w) => {
    const kanji = w.kanji.map((k) => k.text);
    const kana = w.kana.map((k) => k.text);
    return {
      id: w.id,
      kanji,
      kana,
      forms: [...new Set([...kanji, ...kana])],
      senses: w.sense.map((s) => ({
        pos: s.partOfSpeech,
        gloss: s.gloss.map((g) => g.text),
      })),
    };
  });
}

export function transformPosTags(tags: PosTagMap, words: RawWord[]): PosTagMap {
  const used = new Set(words.flatMap((w) => w.sense.flatMap((s) => s.partOfSpeech)));
  return Object.fromEntries(Object.entries(tags).filter(([code]) => used.has(code)));
}

export function transformPitch(accentsTxt: string): PitchMap {
  const map: PitchMap = {};
  for (const line of accentsTxt.split('\n')) {
    if (!line.trim()) continue;
    const [term, reading, accents] = line.split('\t');
    if (!term || !accents) continue;
    const first = parseInt(accents.split(',')[0], 10);
    if (Number.isNaN(first)) continue;
    const key = `${term}|${reading || term}`;
    if (!(key in map)) map[key] = first;
    if (!(term in map)) map[term] = first;
  }
  return map;
}
