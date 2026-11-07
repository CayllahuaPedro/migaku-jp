import type { Cue } from '../../core/cues';
import type { Settings } from '../../core/settings';
import type { SubtitleOverlay } from '../../ui/SubtitleOverlay';
import { BRIDGE_SOURCE, type ToIsolated, type ToMain } from './bridge';
import { parseJson3 } from './json3';
import {
  buildTrackUrl,
  selectTracks,
  type CaptionTrack,
  type TrackSelection,
  type TranslationSource,
} from './tracks';

export interface SessionDeps {
  fetchText(url: string): Promise<string>;
  send(msg: ToMain): void;
  mountOverlay(): SubtitleOverlay | null;
  attach(overlay: SubtitleOverlay, primary: Cue[], secondary: Cue[]): () => void;
  setNativeHidden(hidden: boolean): void;
}

const YOUTUBE_ORIGIN = 'https://www.youtube.com';
const TIMEDTEXT_PATH = '/api/timedtext';
const RETRY_DELAY_MS = 2000;
const TEMPLATE_TIMEOUT_MS = 5000;
const MAX_RETRIES = 3;

const warn = (message: string, ...details: unknown[]) => console.warn(`[yabai-jp] ${message}`, ...details);

function guard(label: string, action: () => void): boolean {
  try {
    action();
    return true;
  } catch (error) {
    warn(label, error);
    return false;
  }
}

function normalizeTemplate(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url, YOUTUBE_ORIGIN);
  } catch (error) {
    warn('ignoring malformed timedtext URL', error);
    return null;
  }
  if (parsed.origin !== YOUTUBE_ORIGIN || parsed.pathname !== TIMEDTEXT_PATH) {
    warn('ignoring timedtext URL outside youtube.com', parsed.origin + parsed.pathname);
    return null;
  }
  return parsed.toString();
}

function translationUrl(template: string, translation: TranslationSource | null): string | null {
  if (!translation) return null;
  const request =
    translation.type === 'track'
      ? { lang: translation.track.languageCode, kind: translation.track.kind }
      : { lang: translation.from.languageCode, kind: translation.from.kind, tlang: translation.tlang };
  return buildTrackUrl(template, request);
}

interface TrackUrls {
  ja: string;
  translation: string | null;
}

function trackUrls(template: string, selection: TrackSelection): TrackUrls | null {
  try {
    const { ja, translation } = selection;
    return {
      ja: buildTrackUrl(template, { lang: ja.languageCode, kind: ja.kind }),
      translation: translationUrl(template, translation),
    };
  } catch (error) {
    warn('could not build subtitle URLs', error);
    return null;
  }
}

export class YoutubeSession {
  private videoId: string | null = null;
  private generation = 0;
  private tracksSeen = false;
  private tracks: CaptionTrack[] = [];
  private template: string | null = null;
  private selection: TrackSelection | null = null;
  private started = false;
  private ensured = false;
  private overlay: SubtitleOverlay | null = null;
  private detach: (() => void) | null = null;
  private jaCues: Cue[] | null = null;
  private retries = 0;
  private gaveUp = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private deps: SessionDeps,
    private settings: Settings,
  ) {}

  async onMessage(msg: ToIsolated): Promise<void> {
    if (!this.settings.youtubeDualSubs || msg.videoId !== this.videoId) return;
    if (msg.type === 'timedtext-url') {
      const template = normalizeTemplate(msg.url);
      if (!template) return;
      this.template = template;
      return this.maybeStart();
    }
    if (this.tracksSeen) return;
    this.tracksSeen = true;
    if (msg.isLive) return this.abandonVideo();
    this.tracks = msg.tracks;
    return this.select();
  }

  onNavigate(videoId: string | null): void {
    if (videoId === this.videoId) return;
    this.resetVideo();
    this.videoId = videoId;
    this.requestState();
  }

  async onSettings(settings: Settings): Promise<void> {
    const previous = this.settings;
    this.settings = settings;
    if (!settings.youtubeDualSubs) {
      if (previous.youtubeDualSubs) this.resetVideo();
      return;
    }
    if (!previous.youtubeDualSubs) {
      this.resetVideo();
      this.requestState();
      return;
    }
    if (settings.nativeLang === previous.nativeLang) return;
    if (this.overlay && this.jaCues) return this.refetchTranslation();
    if (!this.tracksSeen) return;
    this.generation++;
    this.started = false;
    return this.select();
  }

  teardown(): void {
    this.resetVideo();
    this.videoId = null;
  }

  private requestState(): void {
    if (!this.settings.youtubeDualSubs || !this.videoId) return;
    this.send({ source: BRIDGE_SOURCE, type: 'request-state' });
  }

  private async select(): Promise<void> {
    this.selection = selectTracks(this.tracks, this.settings.nativeLang);
    if (!this.selection) return this.abandonVideo();
    this.ensureCaptions();
    return this.maybeStart();
  }

  private ensureCaptions(): void {
    if (this.gaveUp || this.ensured || !this.selection) return;
    this.ensured = true;
    this.send({ source: BRIDGE_SOURCE, type: 'ensure-captions', track: this.selection.ja });
    this.later(TEMPLATE_TIMEOUT_MS, () => {
      if (!this.started) this.retryOrAbandon();
    });
  }

  private async maybeStart(): Promise<void> {
    if (this.gaveUp || this.started || !this.selection || !this.template) return;
    this.started = true;
    const generation = this.generation;
    const urls = trackUrls(this.template, this.selection);
    if (!urls) return this.abandonVideo();
    const [jaCues, translationCues] = await Promise.all([
      this.fetchCues(urls.ja, 'Japanese'),
      urls.translation ? this.fetchCues(urls.translation, 'translation') : null,
    ]);
    if (generation !== this.generation) return;
    if (!jaCues?.length) return this.retryOrAbandon();
    this.show(jaCues, translationCues ?? []);
  }

  private retryOrAbandon(): void {
    if (this.retries >= MAX_RETRIES) {
      this.gaveUp = true;
      warn('no Japanese cues for this video');
      return this.abandonVideo();
    }
    this.retries++;
    this.started = false;
    this.template = null;
    this.later(RETRY_DELAY_MS, () => {
      if (this.started) return;
      this.restoreCaptions();
      this.ensureCaptions();
    });
  }

  private later(delay: number, action: () => void): void {
    this.cancelRetry();
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      action();
    }, delay);
  }

  private cancelRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private async refetchTranslation(): Promise<void> {
    const generation = ++this.generation;
    this.selection = selectTracks(this.tracks, this.settings.nativeLang);
    if (!this.selection || !this.template) return this.abandonVideo();
    const urls = trackUrls(this.template, this.selection);
    if (!urls) return this.abandonVideo();
    const translationCues = urls.translation ? await this.fetchCues(urls.translation, 'translation') : null;
    if (generation !== this.generation || !this.overlay || !this.jaCues) return;
    this.runDetach();
    this.attachCues(this.overlay, this.jaCues, translationCues ?? []);
  }

  private show(jaCues: Cue[], translationCues: Cue[]): void {
    const overlay = this.mountOverlay();
    if (!overlay) return this.abandonVideo();
    this.overlay = overlay;
    this.jaCues = jaCues;
    this.setNativeHidden(true);
    this.attachCues(overlay, jaCues, translationCues);
  }

  private mountOverlay(): SubtitleOverlay | null {
    try {
      const overlay = this.deps.mountOverlay();
      if (!overlay) warn('no player to mount the subtitle overlay on');
      return overlay;
    } catch (error) {
      warn('could not mount the subtitle overlay', error);
      return null;
    }
  }

  private attachCues(overlay: SubtitleOverlay, jaCues: Cue[], translationCues: Cue[]): void {
    const attached = guard('could not attach the subtitle overlay', () => {
      this.detach = this.deps.attach(overlay, jaCues, translationCues);
    });
    if (!attached) this.abandonVideo();
  }

  private async fetchCues(url: string, label: string): Promise<Cue[] | null> {
    try {
      return parseJson3(await this.deps.fetchText(url));
    } catch (error) {
      warn(`${label} subtitle fetch failed`, error);
      return null;
    }
  }

  private abandonVideo(): void {
    this.cancelRetry();
    this.resetVideoView();
    this.restoreCaptions();
  }

  private resetVideo(): void {
    this.generation++;
    this.abandonVideo();
    this.tracksSeen = false;
    this.tracks = [];
    this.template = null;
    this.selection = null;
    this.started = false;
    this.retries = 0;
    this.gaveUp = false;
  }

  private resetVideoView(): void {
    this.runDetach();
    const overlay = this.overlay;
    this.overlay = null;
    this.jaCues = null;
    if (overlay) guard('could not destroy the subtitle overlay', () => overlay.destroy());
    this.setNativeHidden(false);
  }

  private runDetach(): void {
    const detach = this.detach;
    this.detach = null;
    if (detach) guard('could not detach the subtitle overlay', detach);
  }

  private restoreCaptions(): void {
    if (!this.ensured) return;
    this.ensured = false;
    this.send({ source: BRIDGE_SOURCE, type: 'restore-captions' });
  }

  private send(msg: ToMain): void {
    guard(`could not send ${msg.type}`, () => this.deps.send(msg));
  }

  private setNativeHidden(hidden: boolean): void {
    guard('could not toggle native captions', () => this.deps.setNativeHidden(hidden));
  }
}
