import { describe, it, expect } from 'vitest';
import { toMora } from '../src/core/mora';

describe('toMora', () => {
  it('splits plain kana one per mora', () => {
    expect(toMora('さくら')).toEqual(['さ', 'く', 'ら']);
  });
  it('joins youon small kana to previous mora', () => {
    expect(toMora('きゃく')).toEqual(['きゃ', 'く']);
  });
  it('keeps sokuon and long vowel as own moras', () => {
    expect(toMora('がっこう')).toEqual(['が', 'っ', 'こ', 'う']);
    expect(toMora('ニュース')).toEqual(['ニュ', 'ー', 'ス']);
  });
  it('handles empty string', () => {
    expect(toMora('')).toEqual([]);
  });
});
