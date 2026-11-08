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

interface RenderedLine {
  text: string;
  tokens: RenderToken[] | null;
  el: HTMLElement;
}

export interface SubtitleOverlayOptions {
  controlsHiddenClass?: string;
  suppressedClass?: string;
  onWordClick?: (word: WordRef, anchor: DOMRect) => void;
  onSuppressed?: () => void;
  onDestroy?: () => void;
}

export class SubtitleOverlay {
  private host: HTMLElement;
  private root: ShadowRoot;
  private observer: MutationObserver;
  private primaryLine: RenderedLine | null = null;
  private secondaryLine: RenderedLine | null = null;
  private pressedOnWord = false;

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
    this.primaryLine = this.reuseOrBuild(this.primaryLine, primary, primaryTokens, 'mjp-sub-primary');
    this.secondaryLine = this.reuseOrBuild(this.secondaryLine, secondary, null, 'mjp-sub-secondary');
    this.root.querySelector('.mjp-sub')?.remove();
    if (!this.primaryLine && !this.secondaryLine) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'mjp-sub';
    if (this.primaryLine) wrapper.append(this.primaryLine.el);
    if (this.secondaryLine) wrapper.append(this.secondaryLine.el);
    this.root.append(wrapper);
  }

  destroy(): void {
    this.observer.disconnect();
    this.container.removeEventListener('click', this.swallowStrayClick, true);
    this.container.removeEventListener('pointerup', this.releasePress, true);
    this.host.remove();
    this.options.onDestroy?.();
  }

  private reuseOrBuild(
    current: RenderedLine | null,
    text: string | null,
    tokens: RenderToken[] | null,
    variant: string,
  ): RenderedLine | null {
    if (!text) return null;
    if (current && current.text === text && current.tokens === tokens) return current;
    return { text, tokens, el: this.line(text, variant, tokens) };
  }

  private line(text: string, variant: string, tokens: RenderToken[] | null = null): HTMLElement {
    const el = document.createElement('p');
    el.className = `mjp-sub-line ${variant}`;
    if (tokens) el.append(renderTokens(tokens.map((t) => ({ ...t, ruby: null }))));
    else el.textContent = text;
    return el;
  }

  private readonly swallowStrayClick = (event: Event): void => {
    if (!this.pressedOnWord) return;
    this.pressedOnWord = false;
    if (event.composedPath().some((n) => n instanceof Element && n.classList.contains('mjp-token'))) return;
    event.stopPropagation();
    event.preventDefault();
  };

  private readonly releasePress = (): void => {
    setTimeout(() => {
      this.pressedOnWord = false;
    }, 0);
  };

  private listenToWords(onWordClick: (word: WordRef, anchor: DOMRect) => void): void {
    this.container.addEventListener('click', this.swallowStrayClick, true);
    this.container.addEventListener('pointerup', this.releasePress, true);
    for (const type of WORD_EVENTS) {
      this.root.addEventListener(type, (event) => {
        const token = (event.target as Element).closest?.('.mjp-token') as HTMLElement | null;
        if (!token) return;
        event.stopPropagation();
        if (type === 'pointerdown') this.pressedOnWord = true;
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
    const wasSuppressed = this.host.hasAttribute(SUPPRESSED_ATTR);
    const suppressed = this.containerHas(this.options.suppressedClass);
    this.host.toggleAttribute(SUPPRESSED_ATTR, suppressed);
    if (suppressed && !wasSuppressed) this.options.onSuppressed?.();
  }

  private containerHas(className: string | undefined): boolean {
    return className !== undefined && this.container.classList.contains(className);
  }
}
