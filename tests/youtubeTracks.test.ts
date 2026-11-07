import { describe, expect, it } from 'vitest';
import { buildTrackUrl, selectTracks } from '../src/surfaces/youtube/tracks';

const ja = { languageCode: 'ja' };
const jaAsr = { languageCode: 'ja', kind: 'asr' as const };
const en = { languageCode: 'en' };

describe('selectTracks', () => {
  it('prefers human Japanese over ASR', () =>
    expect(selectTracks([jaAsr, ja, en], 'en')?.ja).toEqual(ja));
  it('falls back to Japanese ASR', () =>
    expect(selectTracks([jaAsr], 'en')?.ja).toEqual(jaAsr));
  it('uses the human native-language track when present', () =>
    expect(selectTracks([ja, en], 'en')?.translation).toEqual({ type: 'track', track: en }));
  it('falls back to YouTube auto-translation from the chosen Japanese track', () =>
    expect(selectTracks([jaAsr], 'es')?.translation).toEqual({ type: 'auto', from: jaAsr, tlang: 'es' }));
  it('ignores ASR tracks in the native language', () =>
    expect(selectTracks([ja, { languageCode: 'en', kind: 'asr' }], 'en')?.translation)
      .toEqual({ type: 'auto', from: ja, tlang: 'en' }));
  it('matches regional codes like ja-JP and en-US', () =>
    expect(selectTracks([{ languageCode: 'ja-JP' }, { languageCode: 'en-US' }], 'en')?.translation?.type).toBe('track'));
  it('returns null without any Japanese track', () => expect(selectTracks([en], 'en')).toBeNull());
  it('returns null when the native language is Japanese', () => expect(selectTracks([ja, en], 'ja')).toBeNull());
});

describe('buildTrackUrl', () => {
  const T = 'https://www.youtube.com/api/timedtext?v=abc&lang=ja&kind=asr&pot=TOKEN&c=WEB&fmt=srv3&tlang=fr';
  it('rewrites lang, forces json3 and keeps the token', () => {
    const u = new URL(buildTrackUrl(T, { lang: 'en' }));
    expect(u.searchParams.get('lang')).toBe('en');
    expect(u.searchParams.get('fmt')).toBe('json3');
    expect(u.searchParams.get('pot')).toBe('TOKEN');
    expect(u.searchParams.get('c')).toBe('WEB');
    expect(u.searchParams.has('kind')).toBe(false);
    expect(u.searchParams.has('tlang')).toBe(false);
  });
  it('sets kind and tlang when requested', () => {
    const u = new URL(buildTrackUrl(T, { lang: 'ja', kind: 'asr', tlang: 'en' }));
    expect(u.searchParams.get('kind')).toBe('asr');
    expect(u.searchParams.get('tlang')).toBe('en');
  });
});
