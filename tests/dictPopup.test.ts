import { describe, it, expect, vi } from 'vitest';
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
  it('shows the pitch pattern as a labelled pill with the accent position', () => {
    const html = renderPopupHtml(data);
    expect(html).toMatch(/class="mjp-pill mjp-atamadaka"[^>]*>[\s\S]*Atamadaka[\s\S]*1/);
    expect(html).toContain('<span class="mjp-pill-label">Atamadaka</span>');
    expect(html).not.toContain('mjp-pill-dot');
  });
  it('shows an unknown pill when there is no pitch data', () => {
    const html = renderPopupHtml({ ...data, accentPos: null });
    expect(html).toContain('mjp-pill mjp-unknown');
    expect(html).toContain('Sin datos de acento');
  });
  it('renders senses as a numbered list with one chip per part of speech', () => {
    const html = renderPopupHtml({
      ...data,
      entries: [{ ...data.entries[0], senses: [{ pos: ['n', 'adj-no'], gloss: ['cat'] }] }],
    });
    expect(html).toContain('<ol class="mjp-senses">');
    expect(html.match(/class="mjp-chip"/g)).toHaveLength(2);
  });
  it('shows the pos description as a tooltip on its chip, escaped', () => {
    const html = renderPopupHtml({
      ...data,
      entries: [{ ...data.entries[0], senses: [{ pos: ['n', 'adj-no'], gloss: ['cat'] }] }],
      posTags: { 'adj-no': `nouns which may take the "no" particle <x>` },
    });
    expect(html).toContain(
      '<span class="mjp-chip" title="nouns which may take the &quot;no&quot; particle &lt;x&gt;">adj-no</span>',
    );
    expect(html).toContain('<span class="mjp-chip">n</span>');
  });
  it('shows up to five senses of the first entry and counts the hidden ones', () => {
    const sense = (g: string) => ({ pos: ['n'], gloss: [g] });
    const html = renderPopupHtml({
      ...data,
      entries: [
        { ...data.entries[0], senses: ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(sense) },
        { ...data.entries[0], id: '2', senses: [sense('other')] },
      ],
    });
    expect(html.match(/<li>/g)).toHaveLength(5);
    expect(html).not.toContain('>f<');
    expect(html).not.toContain('other');
    expect(html).toContain('3 acepciones más');
    expect(html).not.toContain('+3');
  });
  it('uses the singular when only one sense is hidden', () => {
    const sense = (g: string) => ({ pos: ['n'], gloss: [g] });
    const html = renderPopupHtml({
      ...data,
      entries: [{ ...data.entries[0], senses: ['a', 'b', 'c', 'd', 'e', 'f'].map(sense) }],
    });
    expect(html).toContain('1 acepción más');
  });
  it('omits the hidden count when every sense is shown', () => {
    expect(renderPopupHtml(data)).not.toContain('más</p>');
  });
  it('shows fallback when there are no entries', () => {
    const html = renderPopupHtml({ ...data, entries: [] });
    expect(html).toContain('No está en el diccionario');
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
  it('places the popup above the anchor when asked', () => {
    const popup = new DictPopup(document.body);
    const anchor = { top: 500, bottom: 516, left: 10, right: 40 } as DOMRect;
    const spy = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(100);
    popup.show(anchor, data, 'above');
    const host = [...document.querySelectorAll('.mjp-popup-host')].at(-1) as HTMLElement;
    expect((host.shadowRoot!.querySelector('.mjp-popup') as HTMLElement).style.top).toBe('392px');
    popup.show(anchor, data);
    expect((host.shadowRoot!.querySelector('.mjp-popup') as HTMLElement).style.top).toBe('524px');
    spy.mockRestore();
  });
});
