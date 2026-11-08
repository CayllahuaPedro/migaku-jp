import { browser } from 'wxt/browser';
import type { RenderToken } from '../../core/annotate';
import { renderTokens } from '../../core/render';
import { linkFontStylesheet } from '../fonts';
import { FONTS_CSS_PATH } from '../theme';
import { OVERLAY_CSS } from './styles';

const CONTROLS_HIDDEN_ATTR = 'data-mjp-controls-hidden';
const SUPPRESSED_ATTR = 'data-mjp-suppressed';

const WORD_EVENTS = ['click', 'mousedown', 'pointerdown', 'dblclick'] as const;

export interface WordRef {
  surface: string;
  basicForm: string;
  reading?: string;
}

export interface SubtitleOverlayOptions {
  controlsHiddenClass?: string;
  suppressedClass?: string;
  onWordClick?: (word: WordRef, anchor: DOMRect) => void;
  onDestroy?: () => void;
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
    if (options.onWordClick) this.listenToWords(options.onWordClick);
    container.append(this.host);
    this.observer = new MutationObserver(() => this.syncContainerState());
    this.observer.observe(container, { attributes: true, attributeFilter: ['class'] });
  }

  setLines(primary: string | null, secondary: string | null, primaryTokens: RenderToken[] | null = null): void {
    this.root.querySelector('.mjp-sub')?.remove();
    if (!primary && !secondary) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'mjp-sub';
    if (primary) wrapper.append(this.line(primary, 'mjp-sub-primary', primaryTokens));
    if (secondary) wrapper.append(this.line(secondary, 'mjp-sub-secondary'));
    this.root.append(wrapper);
  }

  destroy(): void {
    this.observer.disconnect();
    this.host.remove();
    this.options.onDestroy?.();
  }

  private line(text: string, variant: string, tokens: RenderToken[] | null = null): HTMLElement {
    const el = document.createElement('p');
    el.className = `mjp-sub-line ${variant}`;
    if (tokens) el.append(renderTokens(tokens.map((t) => ({ ...t, ruby: null }))));
    else el.textContent = text;
    return el;
  }

  private listenToWords(onWordClick: (word: WordRef, anchor: DOMRect) => void): void {
    for (const type of WORD_EVENTS) {
      this.root.addEventListener(type, (event) => {
        const token = (event.target as Element).closest?.('.mjp-token') as HTMLElement | null;
        if (!token) return;
        event.stopPropagation();
        if (type !== 'click') return;
        onWordClick(
          {
            surface: token.dataset.mjpSurface ?? '',
            basicForm: token.dataset.mjpBasicForm ?? '',
            reading: token.dataset.mjpReading,
          },
          token.getBoundingClientRect(),
        );
      });
    }
  }

  private syncContainerState(): void {
    this.host.toggleAttribute(CONTROLS_HIDDEN_ATTR, this.containerHas(this.options.controlsHiddenClass));
    this.host.toggleAttribute(SUPPRESSED_ATTR, this.containerHas(this.options.suppressedClass));
  }

  private containerHas(className: string | undefined): boolean {
    return className !== undefined && this.container.classList.contains(className);
  }
}
