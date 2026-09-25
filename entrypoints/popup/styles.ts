import { THEME_VARS } from '../../src/ui/theme';

export const POPUP_PAGE_CSS = `
:root { ${THEME_VARS} }
* { box-sizing: border-box; }
body {
  margin: 0;
  width: 280px;
  background: var(--mjp-bg);
  color: var(--mjp-text);
  font: 400 14px/1.5 var(--mjp-font-body);
}
.panel { display: flex; flex-direction: column; padding: 20px 20px 16px; }
.brand { margin: 0 0 18px; line-height: 0; }
.brand img { height: 36px; }
button {
  border: 0;
  color: var(--mjp-text);
  cursor: pointer;
  font-family: var(--mjp-font-display);
}
button:focus-visible { outline: 2px solid var(--mjp-yellow); outline-offset: 2px; }
.btn-primary {
  padding: 13px 16px;
  border-radius: var(--mjp-radius-full);
  background: var(--mjp-accent);
  font-size: 15px;
  font-weight: 700;
  line-height: 1;
  transition: transform 0.12s;
}
.btn-primary:hover { transform: translateY(-1px); }
.btn-primary:active { transform: translateY(1px); }
.btn-text {
  align-self: center;
  margin-top: 8px;
  padding: 6px 10px;
  border-radius: var(--mjp-radius-sm);
  background: none;
  color: var(--mjp-muted);
  font-size: 13px;
  font-weight: 700;
}
.btn-text:hover { color: var(--mjp-text); }
.status {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 12px 0 0;
  padding-top: 12px;
  border-top: 1px solid var(--mjp-line);
  font-size: 12px;
  color: var(--mjp-muted);
}
.status[data-state='idle'] { display: none; }
.status-dot {
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  margin-top: 6px;
  border-radius: var(--mjp-radius-full);
  background: currentColor;
}
.status[data-state='busy'] .status-dot { color: var(--mjp-yellow); }
.status[data-state='ok'] .status-dot { color: var(--mjp-success); }
.status[data-state='error'] { color: var(--mjp-error); }
@media (prefers-reduced-motion: no-preference) {
  .status[data-state='busy'] .status-dot { animation: pulse 1s ease-in-out infinite; }
}
@keyframes pulse { 50% { opacity: 0.3; } }
`;
