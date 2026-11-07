import { BRIDGE_SOURCE, extractTracks, isTimedtextUrl, type ToIsolated, type ToMain } from './bridge';
import type { CaptionTrack } from './tracks';

export interface YoutubePlayer {
  getPlayerResponse?(): unknown;
  getOption?(module: string, option: string): unknown;
  setOption?(module: string, option: string, value: unknown): void;
  loadModule?(module: string): void;
  unloadModule?(module: string): void;
}

export interface HookTarget {
  fetch: typeof fetch;
  XMLHttpRequest: { prototype: Pick<XMLHttpRequest, 'open'> };
}

export interface MainWorldDeps {
  getPlayer(): YoutubePlayer | null;
  post(msg: ToIsolated): void;
  currentVideoId(): string | null;
}

type TimedtextMessage = Extract<ToIsolated, { type: 'timedtext-url' }>;
type TracksMessage = Extract<ToIsolated, { type: 'tracks' }>;
type CaptionsOption = Record<string, unknown> & { languageCode: string };

const YOUTUBE_ORIGIN = 'https://www.youtube.com';
const POLL_INTERVAL_MS = 250;
const POLL_TIMEOUT_MS = 5000;

const warn = (message: string, ...details: unknown[]) => console.warn(`[yabai-jp] ${message}`, ...details);

function guard<T>(label: string, action: () => T): T | undefined {
  try {
    return action();
  } catch (error) {
    warn(label, error);
    return undefined;
  }
}

function requestUrl(input: unknown): string | null {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  const url = (input as { url?: unknown } | null)?.url;
  return typeof url === 'string' ? url : null;
}

export function hookTimedtext(target: HookTarget, onTimedtext: (url: string) => void): void {
  const report = (input: unknown) =>
    guard('timedtext hook failed', () => {
      const url = requestUrl(input);
      if (url && isTimedtextUrl(url)) onTimedtext(url);
    });

  const originalFetch = target.fetch;
  target.fetch = function (this: unknown, ...args: Parameters<typeof fetch>) {
    report(args[0]);
    return originalFetch.apply(this, args);
  } as typeof fetch;

  const proto = target.XMLHttpRequest.prototype;
  const originalOpen = proto.open as (...args: unknown[]) => void;
  proto.open = function (this: XMLHttpRequest, ...args: unknown[]) {
    report(args[1]);
    return originalOpen.apply(this, args);
  } as XMLHttpRequest['open'];
}

function videoIdFromUrl(url: string): string | null {
  try {
    return new URL(url, YOUTUBE_ORIGIN).searchParams.get('v') || null;
  } catch {
    return null;
  }
}

function asCaptionsOption(value: unknown): CaptionsOption | null {
  const option = value as Partial<CaptionsOption> | null | undefined;
  return typeof option?.languageCode === 'string' ? (option as CaptionsOption) : null;
}

export class MainWorldAgent {
  private lastTimedtext: TimedtextMessage | null = null;
  private lastTracks: TracksMessage | null = null;
  private poll: { videoId: string; timer: ReturnType<typeof setTimeout> } | null = null;
  private remembered: { prior: CaptionsOption | null } | null = null;

  constructor(private deps: MainWorldDeps) {}

  onTimedtextUrl(url: string): void {
    const videoId = videoIdFromUrl(url);
    if (!videoId) return;
    this.lastTimedtext = { source: BRIDGE_SOURCE, type: 'timedtext-url', videoId, url };
    this.post(this.lastTimedtext);
  }

  onNavigate(): void {
    this.stopPolling();
    this.publishTracks();
  }

  onMessage(msg: ToMain): void {
    if (msg.type === 'request-state') this.replayState();
    else if (msg.type === 'ensure-captions') this.ensureCaptions(msg.track);
    else this.restoreCaptions();
  }

  private replayState(): void {
    const videoId = this.deps.currentVideoId();
    if (!videoId) return;
    if (this.lastTimedtext?.videoId === videoId) this.post(this.lastTimedtext);
    if (this.lastTracks?.videoId === videoId) this.post(this.lastTracks);
    else if (this.poll?.videoId !== videoId) this.publishTracks();
  }

  private publishTracks(): void {
    const videoId = this.deps.currentVideoId();
    if (!videoId) return;
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    const attempt = () => {
      this.poll = null;
      if (this.deps.currentVideoId() !== videoId) return;
      const response = this.readPlayerResponse(videoId);
      if (response) {
        this.lastTracks = { source: BRIDGE_SOURCE, type: 'tracks', videoId, ...extractTracks(response) };
        this.post(this.lastTracks);
        return;
      }
      if (Date.now() >= deadline) {
        warn(`player response for ${videoId} never became available`);
        return;
      }
      this.poll = { videoId, timer: setTimeout(attempt, POLL_INTERVAL_MS) };
    };
    attempt();
  }

  private readPlayerResponse(videoId: string): unknown {
    const player = this.deps.getPlayer();
    if (typeof player?.getPlayerResponse !== 'function') return null;
    const response = guard('getPlayerResponse failed', () => player.getPlayerResponse!()) as
      | { videoDetails?: { videoId?: unknown } }
      | null
      | undefined;
    return response?.videoDetails?.videoId === videoId ? response : null;
  }

  private stopPolling(): void {
    if (this.poll) clearTimeout(this.poll.timer);
    this.poll = null;
  }

  private ensureCaptions(track: CaptionTrack): void {
    const player = this.deps.getPlayer();
    if (!player) {
      warn('no player to enable captions on');
      return;
    }
    if (!this.remembered) {
      const prior = guard('could not read the caption track', () => player.getOption!('captions', 'track'));
      this.remembered = { prior: asCaptionsOption(prior) };
    }
    guard('could not load the captions module', () => player.loadModule!('captions'));
    const option = { languageCode: track.languageCode, ...(track.kind ? { kind: track.kind } : {}) };
    guard('could not select the Japanese caption track', () => player.setOption!('captions', 'track', option));
  }

  private restoreCaptions(): void {
    const remembered = this.remembered;
    if (!remembered) return;
    this.remembered = null;
    const player = this.deps.getPlayer();
    if (!player) {
      warn('no player to restore captions on');
      return;
    }
    const { prior } = remembered;
    if (prior) guard('could not restore the caption track', () => player.setOption!('captions', 'track', prior));
    else guard('could not unload the captions module', () => player.unloadModule!('captions'));
  }

  private post(msg: ToIsolated): void {
    guard(`could not post ${msg.type}`, () => this.deps.post(msg));
  }
}
