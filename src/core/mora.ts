const SMALL_KANA = new Set([
  'ゃ', 'ゅ', 'ょ', 'ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ', 'ゎ',
  'ャ', 'ュ', 'ョ', 'ァ', 'ィ', 'ゥ', 'ェ', 'ォ', 'ヮ',
]);

export function toMora(reading: string): string[] {
  const moras: string[] = [];
  for (const ch of reading) {
    if (SMALL_KANA.has(ch) && moras.length > 0) {
      moras[moras.length - 1] += ch;
    } else {
      moras.push(ch);
    }
  }
  return moras;
}
