import { DictPopup } from '../../ui/DictPopup';
import type { WordRef } from '../../ui/SubtitleOverlay';
import type { LookupResult } from '../../core/messages';

export interface VideoLike extends EventTarget {
  paused: boolean;
  pause(): void;
  play(): Promise<void> | void;
}

export interface WordLookupDeps {
  container: HTMLElement;
  video: VideoLike;
  lookup(word: WordRef): Promise<LookupResult>;
  pauseEnabled(): boolean;
  doc?: Document;
}

const STOPPED_EVENTS = ['click', 'mousedown', 'pointerdown', 'dblclick'];

export class WordLookup {
  private readonly doc: Document;
  private readonly host: HTMLElement;
  private readonly popup: DictPopup;
  private requestId = 0;
  private isOpen = false;
  private pausedByUs = false;
  private resumeTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly deps: WordLookupDeps) {
    this.doc = deps.doc ?? document;
    this.host = this.doc.createElement('div');
    this.host.dataset.mjpLookup = '';
    for (const type of STOPPED_EVENTS) this.host.addEventListener(type, (e) => e.stopPropagation());
    deps.container.append(this.host);
    this.popup = new DictPopup(this.host);
  }

  async open(word: WordRef, anchor: DOMRect): Promise<void> {
    const id = ++this.requestId;
    if (this.resumeTimer !== undefined) {
      clearTimeout(this.resumeTimer);
      this.resumeTimer = undefined;
      this.pausedByUs = true;
    }
    if (!this.isOpen) {
      this.isOpen = true;
      this.listen();
      if (this.deps.pauseEnabled() && !this.deps.video.paused) {
        this.pausedByUs = true;
        this.deps.video.pause();
      }
    }
    try {
      const res = await this.deps.lookup(word);
      if (id !== this.requestId) return;
      this.popup.show(
        anchor,
        {
          word: word.basicForm,
          reading: word.reading,
          accentPos: res.accentPos,
          entries: res.entries ?? [],
          posTags: res.posTags,
        },
        'above',
      );
    } catch (err) {
      if (id !== this.requestId) return;
      console.warn('[yabai-jp] lookup failed', err);
      this.close();
    }
  }

  close(): void {
    this.requestId++;
    this.popup.hide();
    this.unlisten();
    this.isOpen = false;
    if (!this.pausedByUs) return;
    this.pausedByUs = false;
    this.resumeTimer = setTimeout(() => {
      this.resumeTimer = undefined;
      if (this.deps.video.paused) void this.deps.video.play();
    }, 0);
  }

  dispose(): void {
    this.requestId++;
    this.popup.hide();
    this.unlisten();
    this.isOpen = false;
    this.pausedByUs = false;
    clearTimeout(this.resumeTimer);
    this.resumeTimer = undefined;
    this.host.remove();
  }

  private listen(): void {
    this.doc.addEventListener('click', this.onOutsideClick, true);
    this.doc.addEventListener('keydown', this.onKeydown, true);
    this.deps.video.addEventListener('play', this.onPlay);
  }

  private unlisten(): void {
    this.doc.removeEventListener('click', this.onOutsideClick, true);
    this.doc.removeEventListener('keydown', this.onKeydown, true);
    this.deps.video.removeEventListener('play', this.onPlay);
  }

  private readonly onPlay = (): void => {
    this.pausedByUs = false;
  };

  private readonly onKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.close();
  };

  private readonly onOutsideClick = (e: Event): void => {
    const path = e.composedPath();
    const insideLookup = path.includes(this.host);
    const onWord = path.some((n) => n instanceof Element && n.classList.contains('mjp-token'));
    if (!insideLookup && !onWord) this.close();
  };
}
