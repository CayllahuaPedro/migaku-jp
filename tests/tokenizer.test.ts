// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initTokenizer, tokenize } from '../src/core/tokenizer';

describe('tokenizer', () => {
  beforeAll(async () => {
    await initTokenizer('node_modules/kuromoji/dict');
  }, 60_000);

  it('tokenizes a simple sentence', async () => {
    const tokens = await tokenize('猫を飼う');
    expect(tokens.map((t) => t.surface)).toEqual(['猫', 'を', '飼う']);
    expect(tokens[0].reading).toBe('ネコ');
    expect(tokens[0].basicForm).toBe('猫');
  });

  it('gives dictionary form for inflected verbs', async () => {
    const tokens = await tokenize('飼っている');
    expect(tokens[0].surface).toBe('飼っ');
    expect(tokens[0].basicForm).toBe('飼う');
  });

  it('exposes the POS sub-category', async () => {
    const tokens = await tokenize('食肉目の動物');
    expect(tokens.map((t) => t.posDetail)).toEqual(['一般', '接尾', '連体化', '一般']);
  });
});
