import { tokenize } from '../core/tokenizer';
import { buildRenderTokens } from '../core/annotate';
import { renderTokens, PITCH_CSS } from '../core/render';
import { hasJapanese } from '../core/kana';
import type { TokenQuery, AnnotateResult } from '../core/messages';

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
  annotate: (tokens: TokenQuery[]) => Promise<AnnotateResult>,
): Promise<void> {
  const text = node.data;
  const tokens = await tokenize(text);
  const { accents } = await annotate(
    tokens.map((t) => ({
      basicForm: t.basicForm,
      surface: t.surface,
      reading: t.reading,
    })),
  );
  const wrapper = document.createElement('span');
  wrapper.className = 'mjp-parsed';
  wrapper.dataset.mjpOriginal = text;
  wrapper.append(renderTokens(buildRenderTokens(tokens, accents)));
  node.replaceWith(wrapper);
}

export function revertPage(root: ParentNode): void {
  for (const el of Array.from(root.querySelectorAll('.mjp-parsed'))) {
    const original = (el as HTMLElement).dataset.mjpOriginal ?? el.textContent ?? '';
    el.replaceWith(document.createTextNode(original));
  }
}

export function injectStyles(): void {
  if (document.getElementById('mjp-styles')) return;
  const style = document.createElement('style');
  style.id = 'mjp-styles';
  style.textContent = PITCH_CSS;
  document.head.append(style);
}
