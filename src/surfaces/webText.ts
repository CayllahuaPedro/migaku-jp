import type { RenderToken } from '../core/annotate';
import { renderTokens } from '../core/render';
import { PITCH_COLOR_CSS } from '../ui/theme';
import { linkFontStylesheet } from '../ui/fonts';
import { hasJapanese } from '../core/kana';

const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'CODE', 'PRE',
]);

export function findJapaneseTextNodes(root: Node): Text[] {
  // Recorrido manual en lugar de TreeWalker: happy-dom (entorno de test) no
  // desciende al subárbol de nodos rechazados por whatToShow/acceptNode, lo
  // que rompe SHOW_TEXT sobre contenido anidado. Este recorrido funciona
  // igual en navegadores reales.
  const out: Text[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const parent = (node as Text).parentElement;
      if (!parent) return;
      if (SKIP_TAGS.has(parent.tagName)) return;
      if (parent.closest('.mjp-parsed, .mjp-popup-host')) return;
      if (hasJapanese(node.nodeValue ?? '')) out.push(node as Text);
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      if (SKIP_TAGS.has(el.tagName)) return;
      if (el.classList.contains('mjp-parsed') || el.classList.contains('mjp-popup-host')) {
        return;
      }
    }
    for (const child of Array.from(node.childNodes)) walk(child);
  };
  walk(root);
  return out;
}

export async function parseTextNode(
  node: Text,
  analyze: (text: string) => Promise<RenderToken[]>,
): Promise<void> {
  const text = node.data;
  const tokens = await analyze(text);
  const wrapper = document.createElement('span');
  wrapper.className = 'mjp-parsed';
  wrapper.dataset.mjpOriginal = text;
  wrapper.append(renderTokens(tokens));
  node.replaceWith(wrapper);
}

export function revertPage(root: ParentNode): void {
  for (const el of Array.from(root.querySelectorAll('.mjp-parsed'))) {
    const original = (el as HTMLElement).dataset.mjpOriginal ?? el.textContent ?? '';
    el.replaceWith(document.createTextNode(original));
  }
}

const PAGE_CSS = `
.mjp-token {
  cursor: pointer;
  text-decoration: underline 2px transparent;
  text-underline-offset: 0.3em;
  transition: text-decoration-color 0.12s;
}
.mjp-token:hover { text-decoration-color: currentColor; }
${PITCH_COLOR_CSS}
.mjp-token rt {
  font-family: 'Yabai Maru', sans-serif;
  font-size: 0.55em;
  font-weight: 500;
  letter-spacing: 0.02em;
  opacity: 0.85;
  user-select: none;
}
`;

export function injectStyles(fontsHref: string): void {
  linkFontStylesheet(fontsHref);
  if (document.getElementById('mjp-styles')) return;
  const style = document.createElement('style');
  style.id = 'mjp-styles';
  style.textContent = PAGE_CSS;
  document.head.append(style);
}
