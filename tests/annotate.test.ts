import { describe, it, expect } from 'vitest';
import { buildRenderTokens } from '../src/core/annotate';

describe('buildRenderTokens', () => {
  it('combines furigana + pitch pattern + hiragana reading', () => {
    const tokens = [
      { surface: '猫', reading: 'ネコ', basicForm: '猫', pos: '名詞', posDetail: '一般' },
      { surface: 'を', reading: 'ヲ', basicForm: 'を', pos: '助詞', posDetail: '一般' },
    ];
    const out = buildRenderTokens(tokens, [1, null]);
    expect(out[0]).toEqual({
      surface: '猫',
      ruby: 'ねこ',
      pattern: 'atamadaka',
      basicForm: '猫',
      reading: 'ねこ',
    });
    expect(out[1].pattern).toBe('unknown');
    expect(out[1].ruby).toBeNull();
  });

  it('unknown pattern when there is no reading', () => {
    const out = buildRenderTokens(
      [{ surface: '𩸽', reading: undefined, basicForm: '𩸽', pos: '名詞', posDetail: '一般' }],
      [0],
    );
    expect(out[0].pattern).toBe('unknown');
  });
});
