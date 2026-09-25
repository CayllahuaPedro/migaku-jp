import type { DictEntry } from '../../core/types';
import { classifyPitch, type PitchPattern } from '../../core/pitch';
import { PITCH_COLOR_CSS, THEME_VARS } from '../theme';

export interface PopupData {
  word: string;
  reading?: string;
  accentPos: number | null;
  entries: DictEntry[];
}

const PITCH_LABELS: Record<PitchPattern, string> = {
  heiban: 'Heiban',
  atamadaka: 'Atamadaka',
  nakadaka: 'Nakadaka',
  odaka: 'Odaka',
  unknown: 'Sin datos de acento',
};

const MAX_SENSES = 5;

const escapeHtml =(s: string) =>
  s.replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!,
  );

export function renderPopupHtml(data: PopupData): string {
  const pattern = data.reading
    ? classifyPitch(data.reading, data.accentPos)
    : 'unknown';
  const accentPos =
    data.accentPos === null ? '' : `<span class="mjp-pill-pos">${data.accentPos}</span>`;

  const shown = data.entries[0]?.senses.slice(0, MAX_SENSES) ?? [];
  const hiddenCount =
    data.entries.reduce((total, e) => total + e.senses.length, 0) - shown.length;
  const senses = shown
    .map(
      (s) => `
      <li>
        ${s.pos.map((p) => `<span class="mjp-chip">${escapeHtml(p)}</span>`).join('')}
        <span class="mjp-gloss">${escapeHtml(s.gloss.join('; '))}</span>
      </li>`,
    )
    .join('');
  const more =
    hiddenCount > 0
      ? `<p class="mjp-more">${hiddenCount} ${hiddenCount === 1 ? 'acepción' : 'acepciones'} más</p>`
      : '';

  return `
    <div class="mjp-popup">
      <div class="mjp-head">
        <div class="mjp-headword">
          ${data.reading ? `<span class="mjp-reading">${escapeHtml(data.reading)}</span>` : ''}
          <span class="mjp-word">${escapeHtml(data.word)}</span>
        </div>
        <span class="mjp-pill mjp-${pattern}"><span class="mjp-pill-label">${PITCH_LABELS[pattern]}</span>${accentPos}</span>
      </div>
      ${
        data.entries.length === 0
          ? '<p class="mjp-nodef">No está en el diccionario</p>'
          : `<ol class="mjp-senses">${senses}</ol>${more}`
      }
    </div>`;
}

export const POPUP_CSS = `
:host { ${THEME_VARS} }
.mjp-popup {
  position: fixed;
  z-index: 2147483647;
  box-sizing: border-box;
  width: max-content;
  min-width: 220px;
  max-width: 340px;
  max-height: 320px;
  overflow-y: auto;
  padding: 14px 16px 16px;
  background: var(--mjp-bg);
  color: var(--mjp-text);
  border: 1px solid var(--mjp-line);
  border-radius: var(--mjp-radius-lg);
  box-shadow: 0 16px 36px -12px rgba(11, 6, 48, 0.55);
  font: 400 14px/1.5 var(--mjp-font-body);
  scrollbar-width: thin;
  scrollbar-color: var(--mjp-surface) transparent;
}
.mjp-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
  margin-bottom: 10px;
  border-bottom: 1px solid var(--mjp-line);
}
.mjp-headword { display: flex; flex-direction: column; min-width: 0; }
.mjp-reading {
  font: 500 13px/1.2 var(--mjp-font-display);
  color: var(--mjp-muted);
  letter-spacing: 0.04em;
}
.mjp-word { font: 700 28px/1.15 var(--mjp-font-display); }
${PITCH_COLOR_CSS}
.mjp-unknown { color: var(--mjp-muted); }
.mjp-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 4px 10px;
  border-radius: var(--mjp-radius-full);
  border: 1px solid currentColor;
  background: color-mix(in srgb, currentColor 22%, transparent);
  font: 700 11px/1 var(--mjp-font-display);
  letter-spacing: 0.03em;
}
.mjp-pill-label { color: var(--mjp-text); }
.mjp-pill-pos {
  padding-left: 6px;
  border-left: 1px solid currentColor;
  color: var(--mjp-text);
}
.mjp-senses { margin: 0; padding: 0; list-style: none; counter-reset: sense; }
.mjp-senses li {
  counter-increment: sense;
  position: relative;
  padding-left: 26px;
  margin-top: 8px;
}
.mjp-senses li:first-child { margin-top: 0; }
.mjp-senses li::before {
  content: counter(sense);
  position: absolute;
  left: 0;
  top: 1px;
  width: 18px;
  height: 18px;
  border-radius: var(--mjp-radius-full);
  background: var(--mjp-accent);
  font: 700 10px/18px var(--mjp-font-display);
  text-align: center;
}
.mjp-chip {
  display: inline-block;
  margin: 0 4px 2px 0;
  padding: 1px 7px;
  border-radius: var(--mjp-radius-sm);
  background: var(--mjp-surface);
  color: var(--mjp-accent-soft);
  font: 600 10px/1.6 var(--mjp-font-body);
  vertical-align: 1px;
}
.mjp-gloss { color: var(--mjp-text); }
.mjp-more { margin: 10px 0 0 26px; color: var(--mjp-muted); font-size: 12px; }
.mjp-nodef { margin: 0; color: var(--mjp-muted); font-style: italic; }
`;
