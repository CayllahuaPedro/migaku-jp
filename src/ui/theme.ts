import type { PitchPattern } from '../core/pitch';

export const PITCH_COLORS: Record<Exclude<PitchPattern, 'unknown'>, string> = {
  heiban: '#2b77c9',
  atamadaka: '#d13b3b',
  nakadaka: '#a86400',
  odaka: '#23804a',
};

export const PITCH_COLOR_CSS = Object.entries(PITCH_COLORS)
  .map(([pattern, color]) => `.mjp-${pattern} { color: ${color}; }`)
  .join('\n');

export const FONTS_CSS_PATH = '/fonts/fonts.css';

export const THEME_VARS = `
  --mjp-bg: #10255f;
  --mjp-surface: #1b3474;
  --mjp-accent: #7b46f4;
  --mjp-accent-soft: #c9b3ff;
  --mjp-yellow: #ffe700;
  --mjp-success: #4ade80;
  --mjp-error: #ff77ad;
  --mjp-text: #f5f4ff;
  --mjp-muted: #b8b8e8;
  --mjp-line: rgba(255, 255, 255, 0.1);
  --mjp-radius-lg: 16px;
  --mjp-radius-sm: 8px;
  --mjp-radius-full: 999px;
  --mjp-font-display: 'Yabai Maru', 'Hiragino Maru Gothic ProN', 'Noto Sans JP', system-ui, sans-serif;
  --mjp-font-body: 'Yabai Inter', 'Yabai Maru', system-ui, sans-serif;
`;
