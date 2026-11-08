export function katakanaToHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60),
  );
}

export function hiraganaToKatakana(s: string): string {
  return s.replace(/[ぁ-ゖ]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) + 0x60),
  );
}

export function hasKanji(s: string): boolean {
  return /[㐀-䶿一-龯]/.test(s);
}

export function hasJapanese(s: string): boolean {
  return /[぀-ヿ㐀-䶿一-龯]/.test(s);
}
