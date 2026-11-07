const NATIVE_HIDE_ATTR = 'data-mjp-native-hide';
const NATIVE_HIDE_CSS = '.ytp-caption-window-container { display: none !important; }';

export function setNativeHidden(hidden: boolean): void {
  const existing = document.head.querySelector(`style[${NATIVE_HIDE_ATTR}]`);
  if (!hidden) {
    existing?.remove();
    return;
  }
  if (existing) return;
  const style = document.createElement('style');
  style.setAttribute(NATIVE_HIDE_ATTR, '');
  style.textContent = NATIVE_HIDE_CSS;
  document.head.append(style);
}
