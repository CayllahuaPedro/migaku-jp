import { PITCH_COLORS_ON_DARK, THEME_VARS } from '../theme';

const PITCH_COLOR_ON_DARK_CSS = Object.entries(PITCH_COLORS_ON_DARK)
  .map(([pattern, color]) => `.mjp-${pattern} { color: ${color}; }`)
  .join('\n  ');

export const OVERLAY_CSS = `
  :host {
    ${THEME_VARS}
    --mjp-overlay-bottom: 12%;
    position: absolute;
    inset: auto 0 var(--mjp-overlay-bottom) 0;
    z-index: 59;
    display: flex;
    justify-content: center;
    pointer-events: none;
    container-type: inline-size;
    transition: inset 0.25s ease;
  }
  :host([data-mjp-controls-hidden]) {
    --mjp-overlay-bottom: 4%;
  }
  :host([data-mjp-suppressed]) {
    display: none;
  }
  .mjp-sub {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4cqw;
    max-width: 80%;
    text-align: center;
  }
  .mjp-sub-line {
    margin: 0;
    padding: 0.4em 0.8em;
    border-radius: 0.5em;
    background: rgba(8, 12, 32, 0.78);
    color: var(--mjp-text);
    line-height: 1.35;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
    overflow-wrap: anywhere;
  }
  .mjp-sub-primary {
    font-family: var(--mjp-font-display);
    font-size: clamp(16px, 3.2cqw, 48px);
    font-weight: 700;
  }
  .mjp-sub-secondary {
    font-family: var(--mjp-font-body);
    font-size: clamp(13px, 2.2cqw, 34px);
    color: var(--mjp-muted);
  }
  .mjp-token {
    pointer-events: auto;
    cursor: pointer;
    border-radius: 0.2em;
  }
  .mjp-token:hover {
    background: rgba(255, 255, 255, 0.16);
  }
  ${PITCH_COLOR_ON_DARK_CSS}
`;
