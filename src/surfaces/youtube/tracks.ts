export interface CaptionTrack {
  languageCode: string;
  kind?: 'asr';
  name?: string;
}

export type TranslationSource =
  | { type: 'track'; track: CaptionTrack }
  | { type: 'auto'; from: CaptionTrack; tlang: string };

export interface TrackSelection {
  ja: CaptionTrack;
  translation: TranslationSource | null;
}

const primaryTag = (code: string) => code.split('-')[0];

const matchesLanguage = (track: CaptionTrack, lang: string) =>
  primaryTag(track.languageCode) === primaryTag(lang);

export function selectTracks(tracks: CaptionTrack[], nativeLang: string): TrackSelection | null {
  if (primaryTag(nativeLang) === 'ja') return null;

  const japanese = tracks.filter((t) => matchesLanguage(t, 'ja'));
  const ja = japanese.find((t) => t.kind !== 'asr') ?? japanese[0];
  if (!ja) return null;

  const native = tracks.find((t) => t.kind !== 'asr' && matchesLanguage(t, nativeLang));
  const translation: TranslationSource = native
    ? { type: 'track', track: native }
    : { type: 'auto', from: ja, tlang: nativeLang };

  return { ja, translation };
}

export function buildTrackUrl(
  template: string,
  req: { lang: string; kind?: 'asr'; tlang?: string },
): string {
  const url = new URL(template);
  url.searchParams.set('lang', req.lang);
  url.searchParams.set('fmt', 'json3');
  if (req.kind) url.searchParams.set('kind', req.kind);
  else url.searchParams.delete('kind');
  if (req.tlang) url.searchParams.set('tlang', req.tlang);
  else url.searchParams.delete('tlang');
  return url.toString();
}
