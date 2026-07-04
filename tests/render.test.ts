import { describe, it, expect } from 'vitest';
import { renderTokens } from '../src/core/render';

describe('renderTokens', () => {
  it('renders japanese tokens as colored spans with ruby', () => {
    const frag = renderTokens([
      { surface: '猫', ruby: 'ねこ', pattern: 'atamadaka', basicForm: '猫', reading: 'ねこ' },
      { surface: '!', ruby: null, pattern: 'unknown', basicForm: '!' },
    ]);
    const div = document.createElement('div');
    div.append(frag);
    const span = div.querySelector('span.mjp-token')!;
    expect(span.classList.contains('mjp-atamadaka')).toBe(true);
    expect((span as HTMLElement).dataset.surface).toBe('猫');
    expect((span as HTMLElement).dataset.basicForm).toBe('猫');
    expect(span.querySelector('rt')!.textContent).toBe('ねこ');
    expect(div.childNodes[1].nodeType).toBe(Node.TEXT_NODE);
    expect(div.childNodes[1].textContent).toBe('!');
  });

  it('no ruby element when ruby is null', () => {
    const frag = renderTokens([
      { surface: 'ねこ', ruby: null, pattern: 'atamadaka', basicForm: 'ねこ', reading: 'ねこ' },
    ]);
    const div = document.createElement('div');
    div.append(frag);
    expect(div.querySelector('ruby')).toBeNull();
    expect(div.querySelector('span.mjp-token')!.textContent).toBe('ねこ');
  });
});
