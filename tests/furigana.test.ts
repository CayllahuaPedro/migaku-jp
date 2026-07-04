import { describe, it, expect } from 'vitest';
import { furigana } from '../src/core/furigana';

describe('furigana', () => {
  it('gives hiragana ruby for words with kanji', () => {
    expect(furigana('飼う', 'カウ')).toEqual({ surface: '飼う', ruby: 'かう' });
  });
  it('no ruby for pure kana words', () => {
    expect(furigana('ねこ', 'ネコ')).toEqual({ surface: 'ねこ', ruby: null });
  });
  it('no ruby without reading', () => {
    expect(furigana('猫', undefined)).toEqual({ surface: '猫', ruby: null });
  });
});
