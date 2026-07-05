import { describe, it, expect, beforeEach, vi } from 'vitest';
import { findJapaneseTextNodes, parseTextNode, revertPage } from '../src/surfaces/webText';

vi.mock('../src/core/tokenizer', () => ({
  tokenize: vi.fn(async (text: string) => {
    if (text === '猫を飼う') {
      return [
        { surface: '猫', reading: 'ネコ', basicForm: '猫', pos: '名詞' },
        { surface: 'を', reading: 'ヲ', basicForm: 'を', pos: '助詞' },
        { surface: '飼う', reading: 'カウ', basicForm: '飼う', pos: '動詞' },
      ];
    }
    return [{ surface: text, reading: undefined, basicForm: text, pos: '名詞' }];
  }),
}));

const annotate = async (tokens: { basicForm: string }[]) => ({
  accents: tokens.map((t) => (t.basicForm === '猫' ? 1 : null)),
});

describe('webText surface', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('finds only japanese text nodes outside skip tags', () => {
    document.body.innerHTML =
      '<p>猫が好き</p><p>hello</p><script>const 猫 = 1;</script><code>猫</code>';
    const nodes = findJapaneseTextNodes(document.body);
    expect(nodes.map((n) => n.data)).toEqual(['猫が好き']);
  });

  it('parses a node into colored ruby tokens and reverts', async () => {
    document.body.innerHTML = '<p>猫を飼う</p>';
    const node = findJapaneseTextNodes(document.body)[0];
    await parseTextNode(node, annotate);

    const parsed = document.querySelector('.mjp-parsed') as HTMLElement;
    expect(parsed).not.toBeNull();
    expect(parsed.dataset.original).toBe('猫を飼う');
    const cat = parsed.querySelector('.mjp-token') as HTMLElement;
    expect(cat.classList.contains('mjp-atamadaka')).toBe(true);
    expect(cat.querySelector('rt')!.textContent).toBe('ねこ');

    revertPage(document.body);
    expect(document.querySelector('.mjp-parsed')).toBeNull();
    expect(document.body.textContent).toContain('猫を飼う');
  });

  it('skips already parsed nodes on a second pass', async () => {
    document.body.innerHTML = '<p>猫</p>';
    await parseTextNode(findJapaneseTextNodes(document.body)[0], annotate);
    expect(findJapaneseTextNodes(document.body)).toEqual([]);
  });
});
