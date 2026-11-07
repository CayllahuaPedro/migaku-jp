import { browser } from 'wxt/browser';
import { linkFontStylesheet } from '../fonts';
import { FONTS_CSS_PATH } from '../theme';
import { OVERLAY_CSS } from './styles';

const CONTROLS_HIDDEN_ATTR = 'data-mjp-controls-hidden';
const SUPPRESSED_ATTR = 'data-mjp-suppressed';

export interface SubtitleOverlayOptions {
  controlsHiddenClass?: string;
  suppressedClass?: string;
}

export class SubtitleOverlay {
  private host: HTMLElement;
  private root: ShadowRoot;
  private observer: MutationObserver;

  constructor(
    private container: HTMLElement,
    private options: SubtitleOverlayOptions = {},
  ) {
    linkFontStylesheet(browser.runtime.getURL(FONTS_CSS_PATH));
    this.host = document.createElement('div');
    this.host.setAttribute('data-mjp-overlay', '');
    this.root = this.host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = OVERLAY_CSS;
    this.root.append(style);
    this.syncContainerState();
    container.append(this.host);
    this.observer = new MutationObserver(() => this.syncContainerState());
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

  private syncContainerState(): void {
    this.host.toggleAttribute(CONTROLS_HIDDEN_ATTR, this.containerHas(this.options.controlsHiddenClass));
    this.host.toggleAttribute(SUPPRESSED_ATTR, this.containerHas(this.options.suppressedClass));
  }

  private containerHas(className: string | undefined): boolean {
    return className !== undefined && this.container.classList.contains(className);
  }
}
