import { hasJapanese } from './kana';
import type { RenderToken } from './annotate';

export function renderTokens(tokens: RenderToken[]): DocumentFragment {
  const frag = document.createDocumentFragment();
  for (const t of tokens) {
    if (!hasJapanese(t.surface)) {
      frag.append(t.surface);
      continue;
    }
    const span = document.createElement('span');
    span.className = `mjp-token mjp-${t.pattern}`;
    span.dataset.mjpSurface = t.surface;
    span.dataset.mjpBasicForm = t.basicForm;
    if (t.reading) span.dataset.mjpReading = t.reading;
    if (t.parts) span.dataset.mjpParts = JSON.stringify(t.parts);
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
