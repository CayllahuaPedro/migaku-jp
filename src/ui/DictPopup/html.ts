import type { DictEntry } from '../../core/types';
import { classifyPitch } from '../../core/pitch';

export interface PopupData {
  word: string;
  reading?: string;
  accentPos: number | null;
  entries: DictEntry[];
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!,
  );

export function renderPopupHtml(data: PopupData): string {
  const pattern = data.reading
    ? classifyPitch(data.reading, data.accentPos)
    : 'unknown';
  const accentLabel =
    data.accentPos === null ? 'sin datos de pitch' : `${pattern} [${data.accentPos}]`;

  const senses =
    data.entries.length === 0
      ? '<p class="mjp-nodef">Sin definición</p>'
      : data.entries
          .slice(0, 3)
          .flatMap((e) =>
            e.senses.map(
              (s) => `
      <li>
        <span class="mjp-pos">${escapeHtml(s.pos.join(', '))}</span>
        ${escapeHtml(s.gloss.join('; '))}
      </li>`,
            ),
          )
          .join('');

  return `
    <div class="mjp-popup">
      <div class="mjp-head">
        <span class="mjp-word mjp-${pattern}">${escapeHtml(data.word)}</span>
        ${data.reading ? `<span class="mjp-reading">${escapeHtml(data.reading)}</span>` : ''}
        <span class="mjp-accent">${escapeHtml(accentLabel)}</span>
      </div>
      ${data.entries.length === 0 ? senses : `<ul class="mjp-senses">${senses}</ul>`}
    </div>`;
}

export const POPUP_CSS = `
.mjp-popup {
  position: fixed;
  z-index: 2147483647;
  max-width: 320px;
  max-height: 300px;
  overflow-y: auto;
  background: #1e1e24;
  color: #eee;
  border-radius: 8px;
  padding: 10px 12px;
  font: 14px/1.4 sans-serif;
  box-shadow: 0 4px 16px rgba(0,0,0,.4);
}
.mjp-head { display: flex; gap: 8px; align-items: baseline; margin-bottom: 6px; }
.mjp-word { font-size: 20px; }
.mjp-reading { color: #aaa; }
.mjp-accent { font-size: 11px; color: #888; margin-left: auto; }
.mjp-senses { margin: 0; padding-left: 18px; }
.mjp-pos { color: #8ab4f8; font-size: 11px; margin-right: 4px; }
.mjp-nodef { color: #888; font-style: italic; margin: 0; }
.mjp-heiban { color: #2e7dd1; }
.mjp-atamadaka { color: #d13b3b; }
.mjp-nakadaka { color: #e08a00; }
.mjp-odaka { color: #2fa356; }
`;
