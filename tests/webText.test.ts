import { describe, it, expect, beforeEach } from 'vitest';
import {
  findJapaneseTextNodes,
  parseTextNode,
  revertPage,
  injectStyles,
} from '../src/surfaces/webText';
import type { RenderToken } from '../src/core/annotate';

const cat: RenderToken = {
  surface: '猫',
  ruby: 'ねこ',
  pattern: 'atamadaka',
  basicForm: '猫',
  reading: 'ねこ',
};

const analyze = async (text: string): Promise<RenderToken[]> =>
  text === '猫を飼う'
    ? [
        cat,
        { surface: 'を', ruby: null, pattern: 'unknown', basicForm: 'を' },
        { surface: '飼う', ruby: 'かう', pattern: 'unknown', basicForm: '飼う', reading: 'かう' },
      ]
    : [cat];

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
    await parseTextNode(node, analyze);

    const parsed = document.querySelector('.mjp-parsed') as HTMLElement;
    expect(parsed).not.toBeNull();
    expect(parsed.dataset.mjpOriginal).toBe('猫を飼う');
    const cat = parsed.querySelector('.mjp-token') as HTMLElement;
    expect(cat.classList.contains('mjp-atamadaka')).toBe(true);
    expect(cat.querySelector('rt')!.textContent).toBe('ねこ');

    revertPage(document.body);
    expect(document.querySelector('.mjp-parsed')).toBeNull();
    expect(document.body.textContent).toContain('猫を飼う');
  });

  it('wraps a merged compound as one token with parts', async () => {
    const compound = async (): Promise<RenderToken[]> => [
      {
        surface: '日本語',
        ruby: 'にほんご',
        pattern: 'unknown',
        basicForm: '日本語',
        reading: 'にほんご',
        parts: [
          { basicForm: '日本', surface: '日本', reading: 'ニホン' },
          { basicForm: '語', surface: '語', reading: 'ゴ' },
        ],
      },
    ];
    document.body.innerHTML = '<p>日本語</p>';
    await parseTextNode(findJapaneseTextNodes(document.body)[0], compound);

    const tokens = document.querySelectorAll<HTMLElement>('.mjp-token');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].dataset.mjpParts).toBeDefined();
  });

  it('revert restores the original text after a merged annotation', async () => {
    const compound = async (): Promise<RenderToken[]> => [
      { ...cat, surface: '日本語', parts: [{ basicForm: '日本', surface: '日本' }] },
    ];
    document.body.innerHTML = '<p>日本語</p>';
    await parseTextNode(findJapaneseTextNodes(document.body)[0], compound);
    revertPage(document.body);
    expect(document.querySelector('p')!.textContent).toBe('日本語');
    expect(document.querySelector('.mjp-parsed')).toBeNull();
  });

  it('skips already parsed nodes on a second pass', async () => {
    document.body.innerHTML = '<p>猫</p>';
    await parseTextNode(findJapaneseTextNodes(document.body)[0], analyze);
    expect(findJapaneseTextNodes(document.body)).toEqual([]);
  });

  it('injects pitch styles and the bundled font stylesheet once', () => {
    document.head.innerHTML = '';
    injectStyles('chrome-extension://abc/fonts/fonts.css');
    injectStyles('chrome-extension://abc/fonts/fonts.css');
    expect(document.querySelectorAll('#mjp-styles')).toHaveLength(1);
    const links = document.querySelectorAll<HTMLLinkElement>('link#mjp-fonts');
    expect(links).toHaveLength(1);
    expect(links[0].rel).toBe('stylesheet');
    expect(links[0].getAttribute('href')).toBe('chrome-extension://abc/fonts/fonts.css');
  });
});
