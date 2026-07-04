import { describe, it, expect } from 'vitest';
import { katakanaToHiragana, hasKanji, hasJapanese } from '../src/core/kana';

describe('katakanaToHiragana', () => {
  it('converts katakana to hiragana', () => {
    expect(katakanaToHiragana('ネコ')).toBe('ねこ');
    expect(katakanaToHiragana('カッタ')).toBe('かった');
  });
  it('leaves hiragana, kanji and latin untouched', () => {
    expect(katakanaToHiragana('猫のneko')).toBe('猫のneko');
  });
  it('keeps the long vowel mark', () => {
    expect(katakanaToHiragana('ニュース')).toBe('にゅーす');
  });
});

describe('hasKanji / hasJapanese', () => {
  it('detects kanji', () => {
    expect(hasKanji('猫')).toBe(true);
    expect(hasKanji('ねこ')).toBe(false);
  });
  it('detects any japanese', () => {
    expect(hasJapanese('ねこ')).toBe(true);
    expect(hasJapanese('ネコ')).toBe(true);
    expect(hasJapanese('猫')).toBe(true);
    expect(hasJapanese('cat!')).toBe(false);
  });
});
