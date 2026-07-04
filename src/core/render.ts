import { hasJapanese } from './kana';
import type { RenderToken } from './annotate';

export const PITCH_CSS = `
.mjp-token { cursor: pointer; }
.mjp-heiban { color: #2e7dd1; }
.mjp-atamadaka { color: #d13b3b; }
.mjp-nakadaka { color: #e08a00; }
.mjp-odaka { color: #2fa356; }
.mjp-token rt { font-size: 0.5em; user-select: none; }
`;

export function renderTokens(tokens: RenderToken[]): DocumentFragment {
  const frag = document.createDocumentFragment();
  for (const t of tokens) {
    if (!hasJapanese(t.surface)) {
      frag.append(t.surface);
      continue;
    }
    const span = document.createElement('span');
    span.className = `mjp-token mjp-${t.pattern}`;
    span.dataset.surface = t.surface;
    span.dataset.basicForm = t.basicForm;
    if (t.reading) span.dataset.reading = t.reading;
    if (t.ruby) {
      const ruby = document.createElement('ruby');
      ruby.append(t.surface);
      const rt = document.createElement('rt');
      rt.textContent = t.ruby;
      ruby.append(rt);
      span.append(ruby);
    } else {
      span.textContent = t.surface;
    }
    frag.append(span);
  }
  return frag;
}
