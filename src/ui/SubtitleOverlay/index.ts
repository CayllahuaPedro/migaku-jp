import { browser } from 'wxt/browser';
import { linkFontStylesheet } from '../fonts';
import { FONTS_CSS_PATH } from '../theme';
import { OVERLAY_CSS } from './styles';

const CONTROLS_HIDDEN_CLASS = 'ytp-autohide';
const CONTROLS_HIDDEN_ATTR = 'data-mjp-controls-hidden';

export class SubtitleOverlay {
  private host: HTMLElement;
  private root: ShadowRoot;
  private observer: MutationObserver;

  constructor(private container: HTMLElement) {
    linkFontStylesheet(browser.runtime.getURL(FONTS_CSS_PATH));
    this.host = document.createElement('div');
    this.host.setAttribute('data-mjp-overlay', '');
    this.root = this.host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = OVERLAY_CSS;
    this.root.append(style);
    this.syncControlsState();
    container.append(this.host);
    this.observer = new MutationObserver(() => this.syncControlsState());
    this.observer.observe(container, { attributes: true, attributeFilter: ['class'] });
  }

  setLines(primary: string | null, secondary: string | null): void {
    this.root.querySelector('.mjp-sub')?.remove();
    if (!primary && !secondary) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'mjp-sub';
    if (primary) wrapper.append(this.line(primary, 'mjp-sub-primary'));
    if (secondary) wrapper.append(this.line(secondary, 'mjp-sub-secondary'));
    this.root.append(wrapper);
  }

  destroy(): void {
    this.observer.disconnect();
    this.host.remove();
  }

  private line(text: string, variant: string): HTMLElement {
    const el = document.createElement('p');
    el.className = `mjp-sub-line ${variant}`;
    el.textContent = text;
    return el;
  }

  private syncControlsState(): void {
    const hidden = this.container.classList.contains(CONTROLS_HIDDEN_CLASS);
    this.host.toggleAttribute(CONTROLS_HIDDEN_ATTR, hidden);
  }
}
