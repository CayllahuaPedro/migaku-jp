import { describe, it, expect } from 'vitest';
import { renderPopupHtml } from '../src/ui/DictPopup/html';
import { DictPopup } from '../src/ui/DictPopup';

const data = {
  word: '猫',
  reading: 'ねこ',
  accentPos: 1,
  entries: [
    {
      id: '1',
      kanji: ['猫'],
      kana: ['ねこ'],
      forms: ['猫', 'ねこ'],
      senses: [{ pos: ['n'], gloss: ['cat'] }],
    },
  ],
};

describe('renderPopupHtml', () => {
  it('shows word, reading, pattern and glosses', () => {
    const html = renderPopupHtml(data);
    expect(html).toContain('猫');
    expect(html).toContain('ねこ');
    expect(html).toContain('atamadaka');
    expect(html).toContain('cat');
  });
  it('shows fallback when there are no entries', () => {
    const html = renderPopupHtml({ ...data, entries: [] });
    expect(html).toContain('Sin definición');
  });
  it('escapes html in glosses', () => {
    const evil = {
      ...data,
      entries: [{ ...data.entries[0], senses: [{ pos: ['n'], gloss: ['<img src=x>'] }] }],
    };
    expect(renderPopupHtml(evil)).not.toContain('<img');
  });
});

describe('DictPopup', () => {
  it('shows and hides in shadow dom', () => {
    const popup = new DictPopup(document.body);
    popup.show({ top: 20, bottom: 36, left: 10, right: 40 } as DOMRect, data);
    const host = document.querySelector('.mjp-popup-host') as HTMLElement;
    expect(host.shadowRoot!.querySelector('.mjp-popup')).not.toBeNull();
    popup.hide();
    expect(host.shadowRoot!.querySelector('.mjp-popup')).toBeNull();
  });
});
