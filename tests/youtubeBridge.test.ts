import { describe, expect, it } from 'vitest';
import { extractTracks, isBridgeMessage, isTimedtextUrl } from '../src/surfaces/youtube/bridge';

describe('isBridgeMessage', () => {
  it('accepts only messages tagged with our source', () => {
    expect(isBridgeMessage({ source: 'yabai-jp', type: 'tracks' })).toBe(true);
    expect(isBridgeMessage({ source: 'other' })).toBe(false);
    expect(isBridgeMessage('x')).toBe(false);
    expect(isBridgeMessage(null)).toBe(false);
  });
});

describe('isTimedtextUrl', () => {
  it('detects timedtext URLs', () => {
    expect(isTimedtextUrl('https://www.youtube.com/api/timedtext?v=a&lang=ja')).toBe(true);
    expect(isTimedtextUrl('/api/timedtext?v=a&lang=ja')).toBe(true);
    expect(isTimedtextUrl('https://www.youtube.com/youtubei/v1/player')).toBe(false);
    expect(isTimedtextUrl('not a url ::')).toBe(false);
  });
});

describe('extractTracks', () => {
  it('extracts caption tracks and live flag from a player response', () =>
    expect(
      extractTracks({
        videoDetails: { isLive: false },
        captions: {
          playerCaptionsTracklistRenderer: {
            captionTracks: [
              { languageCode: 'ja', kind: 'asr', name: { simpleText: 'Japanese (auto)' }, baseUrl: 'x' },
            ],
          },
        },
      }),
    ).toEqual({ tracks: [{ languageCode: 'ja', kind: 'asr', name: 'Japanese (auto)' }], isLive: false }));

  it('reads names from runs, drops non-asr kinds and flags live videos', () =>
    expect(
      extractTracks({
        videoDetails: { isLive: true },
        captions: {
          playerCaptionsTracklistRenderer: {
            captionTracks: [
              { languageCode: 'en', kind: 'forced', name: { runs: [{ text: 'English' }] } },
              { languageCode: 'es' },
              { kind: 'asr' },
            ],
          },
        },
      }),
    ).toEqual({
      tracks: [{ languageCode: 'en', name: 'English' }, { languageCode: 'es' }],
      isLive: true,
    }));

  it('returns no tracks for a malformed response', () => {
    expect(extractTracks({})).toEqual({ tracks: [], isLive: false });
    expect(extractTracks(null)).toEqual({ tracks: [], isLive: false });
    expect(extractTracks({ captions: { playerCaptionsTracklistRenderer: { captionTracks: 'x' } } })).toEqual({
      tracks: [],
      isLive: false,
    });
  });
});
