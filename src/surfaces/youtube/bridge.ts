import type { CaptionTrack } from './tracks';

export const BRIDGE_SOURCE = 'yabai-jp';

export type ToIsolated =
  | { source: 'yabai-jp'; type: 'timedtext-url'; videoId: string; url: string }
  | { source: 'yabai-jp'; type: 'tracks'; videoId: string; tracks: CaptionTrack[]; isLive: boolean };

export type ToMain =
  | { source: 'yabai-jp'; type: 'ensure-captions'; track: CaptionTrack }
  | { source: 'yabai-jp'; type: 'restore-captions' }
  | { source: 'yabai-jp'; type: 'request-state' };

export function isBridgeMessage<T extends { source: string }>(data: unknown): data is T {
  return typeof data === 'object' && data !== null && (data as { source?: unknown }).source === BRIDGE_SOURCE;
}

export function isTimedtextUrl(url: string): boolean {
  try {
    return new URL(url, 'https://www.youtube.com').pathname === '/api/timedtext';
  } catch {
    return false;
  }
}

interface RawTrack {
  languageCode?: unknown;
  kind?: unknown;
  name?: { simpleText?: unknown; runs?: { text?: unknown }[] };
}

function trackName(name: RawTrack['name']): string | undefined {
  const text = name?.simpleText ?? name?.runs?.[0]?.text;
  return typeof text === 'string' ? text : undefined;
}

function toTrack(raw: RawTrack): CaptionTrack | null {
  if (typeof raw?.languageCode !== 'string') return null;
  const track: CaptionTrack = { languageCode: raw.languageCode };
  if (raw.kind === 'asr') track.kind = 'asr';
  const name = trackName(raw.name);
  if (name !== undefined) track.name = name;
  return track;
}

export function extractTracks(playerResponse: unknown): { tracks: CaptionTrack[]; isLive: boolean } {
  const response = playerResponse as {
    videoDetails?: { isLive?: unknown };
    captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: unknown } };
  } | null;
  const isLive = response?.videoDetails?.isLive === true;
  const rawTracks = response?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!Array.isArray(rawTracks)) return { tracks: [], isLive };
  const tracks = rawTracks.map(toTrack).filter((t): t is CaptionTrack => t !== null);
  return { tracks, isLive };
}
