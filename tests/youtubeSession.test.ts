import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CaptionTrack } from '../src/surfaces/youtube/tracks';
import type { ToIsolated } from '../src/surfaces/youtube/bridge';
import { YoutubeSession, type SessionDeps } from '../src/surfaces/youtube/session';
import { SubtitleOverlay } from '../src/ui/SubtitleOverlay';
import type { Settings } from '../src/core/settings';

const ja: CaptionTrack = { languageCode: 'ja' };
const jaAsr: CaptionTrack = { languageCode: 'ja', kind: 'asr' };
const en: CaptionTrack = { languageCode: 'en' };

const json3 = (text: string) =>
  JSON.stringify({ events: [{ tStartMs: 0, dDurationMs: 1000, segs: [{ utf8: text }] }] });
const cues = (text: string) => [{ start: 0, end: 1, text }];

const tracksMsg = (videoId: string, tracks: CaptionTrack[], isLive = false): ToIsolated => ({
  source: 'yabai-jp',
  type: 'tracks',
  videoId,
  tracks,
  isLive,
});
const urlMsg = (videoId: string): ToIsolated => ({
  source: 'yabai-jp',
  type: 'timedtext-url',
  videoId,
  url: `https://www.youtube.com/api/timedtext?v=${videoId}&lang=ja&pot=TOKEN&fmt=srv3`,
});

const keyOf = (url: string) => {
  const params = new URL(url).searchParams;
  const tlang = params.get('tlang');
  return tlang ? `${params.get('lang')}>${tlang}` : (params.get('lang') ?? '');
};

const ON: Settings = { youtubeDualSubs: true, nativeLang: 'en' };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function setup(responses: Record<string, string | Error | Promise<string>> = {}, settings = ON) {
  const container = document.createElement('div');
  const overlays: SubtitleOverlay[] = [];
  const detachers: ReturnType<typeof vi.fn>[] = [];
  const deps = {
    fetchText: vi.fn(async (url: string) => {
      const response = responses[keyOf(url)];
      if (response === undefined) throw new Error(`unexpected fetch ${url}`);
      if (response instanceof Error) throw response;
      return response;
    }),
    send: vi.fn(),
    mountOverlay: vi.fn((): SubtitleOverlay | null => {
      const overlay = new SubtitleOverlay(container);
      overlays.push(overlay);
      return overlay;
    }),
    attach: vi.fn(() => {
      const detach = vi.fn();
      detachers.push(detach);
      return detach;
    }),
    setNativeHidden: vi.fn(),
  } satisfies SessionDeps;
  const session = new YoutubeSession(deps, settings);
  const sent = () => deps.send.mock.calls.map(([msg]) => msg.type);
  const fetchedKeys = () => deps.fetchText.mock.calls.map(([url]) => keyOf(url));
  const overlayMounted = () => container.querySelector('[data-mjp-overlay]') !== null;
  return { session, deps, overlays, detachers, sent, fetchedKeys, overlayMounted };
}

const BOTH = { ja: json3('こんにちは'), en: json3('Hello') };

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());
const warned = () => warn.mock.calls.some(([message]) => String(message).startsWith('[yabai-jp]'));

describe('YoutubeSession', () => {
  it('asks main to ensure captions when tracks include Japanese', async () => {
    const { session, deps } = setup(BOTH);
    session.onNavigate('v1');
    await session.onMessage(tracksMsg('v1', [ja, en]));
    expect(deps.send).toHaveBeenCalledWith({ source: 'yabai-jp', type: 'ensure-captions', track: ja });
  });

  it('sends request-state when it starts tracking a video', () => {
    const { session, deps } = setup();
    session.onNavigate('v1');
    expect(deps.send).toHaveBeenCalledWith({ source: 'yabai-jp', type: 'request-state' });
    deps.send.mockClear();
    session.onNavigate(null);
    expect(deps.send).not.toHaveBeenCalledWith({ source: 'yabai-jp', type: 'request-state' });
  });

  it('attaches Japanese + human native cues once tracks and template are known', async () => {
    const { session, deps, overlays, fetchedKeys } = setup(BOTH);
    session.onNavigate('v1');
    await session.onMessage(tracksMsg('v1', [ja, en]));
    expect(deps.attach).not.toHaveBeenCalled();
    await session.onMessage(urlMsg('v1'));
    expect(fetchedKeys().sort()).toEqual(['en', 'ja']);
    expect(deps.fetchText.mock.calls[0][0]).toContain('pot=TOKEN');
    expect(deps.fetchText.mock.calls[0][0]).toContain('fmt=json3');
    expect(deps.setNativeHidden).toHaveBeenLastCalledWith(true);
    expect(deps.attach).toHaveBeenCalledWith(overlays[0], cues('こんにちは'), cues('Hello'));
  });

  it('accepts the template before the tracks', async () => {
    const { session, deps, overlays } = setup(BOTH);
    session.onNavigate('v1');
    await session.onMessage(urlMsg('v1'));
    await session.onMessage(tracksMsg('v1', [ja, en]));
    expect(deps.attach).toHaveBeenCalledWith(overlays[0], cues('こんにちは'), cues('Hello'));
  });

  it('uses tlang auto-translation when no human native track exists', async () => {
    const { session, deps, overlays, fetchedKeys } = setup({ ja: json3('猫'), 'ja>en': json3('Cat') });
    session.onNavigate('v1');
    await session.onMessage(urlMsg('v1'));
    await session.onMessage(tracksMsg('v1', [jaAsr]));
    expect(fetchedKeys().sort()).toEqual(['ja', 'ja>en']);
    const translationUrl = deps.fetchText.mock.calls.map(([u]) => u).find((u) => u.includes('tlang'))!;
    expect(new URL(translationUrl).searchParams.get('tlang')).toBe('en');
    expect(new URL(translationUrl).searchParams.get('kind')).toBe('asr');
    expect(deps.attach).toHaveBeenCalledWith(overlays[0], cues('猫'), cues('Cat'));
  });

  it('shows Japanese only when the translation fetch fails', async () => {
    const { session, deps, overlays } = setup({ ja: json3('猫'), 'ja>en': new Error('429') });
    session.onNavigate('v1');
    await session.onMessage(urlMsg('v1'));
    await session.onMessage(tracksMsg('v1', [ja]));
    expect(deps.attach).toHaveBeenCalledWith(overlays[0], cues('猫'), []);
    expect(deps.setNativeHidden).toHaveBeenLastCalledWith(true);
  });

  it('does nothing for live videos or without Japanese, and restores captions', async () => {
    const live = setup(BOTH);
    live.session.onNavigate('v1');
    await live.session.onMessage(urlMsg('v1'));
    await live.session.onMessage(tracksMsg('v1', [ja, en], true));
    expect(live.deps.attach).not.toHaveBeenCalled();
    expect(live.deps.fetchText).not.toHaveBeenCalled();
    expect(live.deps.setNativeHidden).toHaveBeenLastCalledWith(false);

    const noJapanese = setup(BOTH);
    noJapanese.session.onNavigate('v1');
    await noJapanese.session.onMessage(urlMsg('v1'));
    await noJapanese.session.onMessage(tracksMsg('v1', [en]));
    expect(noJapanese.deps.attach).not.toHaveBeenCalled();
    expect(noJapanese.deps.setNativeHidden).toHaveBeenLastCalledWith(false);
    expect(noJapanese.sent()).not.toContain('ensure-captions');

  });

  describe('when the Japanese track yields no cues', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    const freshUrlMsg = (videoId: string): ToIsolated => ({
      ...urlMsg(videoId),
      url: `https://www.youtube.com/api/timedtext?v=${videoId}&lang=ja&pot=FRESH&fmt=srv3`,
    } as ToIsolated);

    it('reloads the player captions after a delay and starts again from the next template', async () => {
      const responses: Record<string, string> = { ja: '', en: json3('Hello') };
      const { session, deps, overlays, sent } = setup(responses);
      session.onNavigate('v1');
      await session.onMessage(urlMsg('v1'));
      await session.onMessage(tracksMsg('v1', [ja, en]));
      expect(deps.attach).not.toHaveBeenCalled();
      expect(sent()).toEqual(['request-state', 'ensure-captions']);

      await vi.advanceTimersByTimeAsync(2000);
      expect(sent()).toEqual(['request-state', 'ensure-captions', 'restore-captions', 'ensure-captions']);
      expect(deps.fetchText).toHaveBeenCalledTimes(2);

      responses.ja = json3('こんにちは');
      await session.onMessage(freshUrlMsg('v1'));
      expect(deps.fetchText.mock.calls.slice(2).every(([url]) => url.includes('pot=FRESH'))).toBe(true);
      expect(deps.attach).toHaveBeenCalledWith(overlays[0], cues('こんにちは'), cues('Hello'));
      await vi.runAllTimersAsync();
      expect(sent().at(-1)).toBe('ensure-captions');
    });

    it('gives up and restores captions after three retries', async () => {
      const failing = setup({ ja: new Error('403'), en: json3('Hello') });
      failing.session.onNavigate('v1');
      await failing.session.onMessage(urlMsg('v1'));
      await failing.session.onMessage(tracksMsg('v1', [ja, en]));
      for (let retry = 0; retry < 3; retry++) {
        await vi.advanceTimersByTimeAsync(2000);
        await failing.session.onMessage(freshUrlMsg('v1'));
      }
      expect(failing.deps.attach).not.toHaveBeenCalled();
      expect(failing.sent()).toEqual([
        'request-state',
        'ensure-captions',
        ...Array(3).fill(['restore-captions', 'ensure-captions']).flat(),
        'restore-captions',
      ]);
      expect(failing.deps.setNativeHidden).toHaveBeenLastCalledWith(false);
      expect(warned()).toBe(true);
    });

    it('gives up when the player never sends another template', async () => {
      const empty = setup({ ja: json3('♪'), en: json3('Hello') });
      empty.session.onNavigate('v1');
      await empty.session.onMessage(urlMsg('v1'));
      await empty.session.onMessage(tracksMsg('v1', [ja, en]));
      await vi.runAllTimersAsync();
      expect(empty.deps.attach).not.toHaveBeenCalled();
      expect(empty.deps.fetchText).toHaveBeenCalledTimes(2);
      expect(empty.sent().at(-1)).toBe('restore-captions');
    });

    it('nativeLang change after give-up sends no ensure-captions and leaves native captions shown', async () => {
      const { session, deps, sent } = setup({ ja: '', en: json3('Hello'), 'ja>es': json3('Hola') });
      session.onNavigate('v1');
      await session.onMessage(urlMsg('v1'));
      await session.onMessage(tracksMsg('v1', [ja, en]));
      await vi.runAllTimersAsync();
      expect(sent().at(-1)).toBe('restore-captions');
      deps.send.mockClear();

      await session.onSettings({ ...ON, nativeLang: 'es' });
      await session.onMessage(freshUrlMsg('v1'));
      await vi.runAllTimersAsync();

      expect(sent()).not.toContain('ensure-captions');
      expect(deps.attach).not.toHaveBeenCalled();
      expect(deps.setNativeHidden).not.toHaveBeenCalledWith(true);

      session.onNavigate('v2');
      await session.onMessage(tracksMsg('v2', [ja, en]));
      expect(sent()).toContain('ensure-captions');
    });

    it('cancels a pending retry on navigation', async () => {
      const { session, deps, sent } = setup({ ja: '', en: json3('Hello') });
      session.onNavigate('v1');
      await session.onMessage(urlMsg('v1'));
      await session.onMessage(tracksMsg('v1', [ja, en]));
      session.onNavigate('v2');
      deps.send.mockClear();
      await vi.runAllTimersAsync();
      expect(sent()).toEqual([]);
    });

    it('keeps captions untouched when a template arrives during the retry delay', async () => {
      const responses: Record<string, string> = { ja: '', en: json3('Hello') };
      const { session, deps, overlays, sent, overlayMounted } = setup(responses);
      session.onNavigate('v1');
      await session.onMessage(urlMsg('v1'));
      await session.onMessage(tracksMsg('v1', [ja, en]));

      responses.ja = json3('こんにちは');
      await vi.advanceTimersByTimeAsync(1000);
      await session.onMessage(freshUrlMsg('v1'));
      expect(deps.attach).toHaveBeenCalledWith(overlays[0], cues('こんにちは'), cues('Hello'));

      await vi.runAllTimersAsync();
      expect(sent()).toEqual(['request-state', 'ensure-captions']);
      expect(overlayMounted()).toBe(true);
    });
  });

  describe('when the player never requests subtitles after ensure-captions', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('gives up, restores captions and logs without attaching', async () => {
      const { session, deps, sent } = setup(BOTH);
      session.onNavigate('v1');
      await session.onMessage(tracksMsg('v1', [ja, en]));
      expect(sent()).toEqual(['request-state', 'ensure-captions']);

      await vi.runAllTimersAsync();

      expect(sent().at(-1)).toBe('restore-captions');
      expect(warned()).toBe(true);
      expect(deps.fetchText).not.toHaveBeenCalled();
      expect(deps.attach).not.toHaveBeenCalled();
      expect(deps.setNativeHidden).not.toHaveBeenCalledWith(true);
    });

    it('does not give up once the template arrives within the window', async () => {
      const { session, deps, sent } = setup(BOTH);
      session.onNavigate('v1');
      await session.onMessage(tracksMsg('v1', [ja, en]));
      await vi.advanceTimersByTimeAsync(1000);
      await session.onMessage(urlMsg('v1'));

      await vi.runAllTimersAsync();

      expect(deps.attach).toHaveBeenCalledOnce();
      expect(sent()).toEqual(['request-state', 'ensure-captions']);
      expect(warned()).toBe(false);
    });
  });

  it('discards results from a previous video after navigation', async () => {
    const pendingJa = deferred<string>();
    const { session, deps } = setup({ ja: pendingJa.promise, en: json3('Hello') });
    session.onNavigate('v1');
    await session.onMessage(urlMsg('v1'));
    const inflight = session.onMessage(tracksMsg('v1', [ja, en]));
    session.onNavigate('v2');
    pendingJa.resolve(json3('古い'));
    await inflight;
    expect(deps.attach).not.toHaveBeenCalled();
    expect(deps.mountOverlay).not.toHaveBeenCalled();
    expect(deps.setNativeHidden).not.toHaveBeenCalledWith(true);
  });

  it('ignores timedtext-url messages for another videoId', async () => {
    const { session, deps } = setup(BOTH);
    session.onNavigate('v1');
    await session.onMessage(tracksMsg('v1', [ja, en]));
    await session.onMessage(urlMsg('other'));
    await session.onMessage(tracksMsg('other', [ja, en]));
    expect(deps.fetchText).not.toHaveBeenCalled();
    expect(deps.attach).not.toHaveBeenCalled();
  });

  it('toggle off tears down: detach, overlay destroyed, native shown, captions restored', async () => {
    const { session, deps, detachers, overlayMounted, sent } = setup(BOTH);
    session.onNavigate('v1');
    await session.onMessage(urlMsg('v1'));
    await session.onMessage(tracksMsg('v1', [ja, en]));
    expect(overlayMounted()).toBe(true);
    await session.onSettings({ ...ON, youtubeDualSubs: false });
    expect(detachers[0]).toHaveBeenCalledOnce();
    expect(overlayMounted()).toBe(false);
    expect(deps.setNativeHidden).toHaveBeenLastCalledWith(false);
    expect(sent().at(-1)).toBe('restore-captions');

    deps.send.mockClear();
    session.onNavigate('v2');
    await session.onMessage(urlMsg('v2'));
    await session.onMessage(tracksMsg('v2', [ja, en]));
    expect(deps.send).not.toHaveBeenCalled();
    expect(deps.attach).toHaveBeenCalledOnce();
  });

  it('toggle on starts the current video again with request-state', async () => {
    const { session, deps, overlays } = setup(BOTH, { ...ON, youtubeDualSubs: false });
    session.onNavigate('v1');
    expect(deps.send).not.toHaveBeenCalled();
    await session.onSettings(ON);
    expect(deps.send).toHaveBeenCalledWith({ source: 'yabai-jp', type: 'request-state' });
    await session.onMessage(urlMsg('v1'));
    await session.onMessage(tracksMsg('v1', [ja, en]));
    expect(deps.attach).toHaveBeenCalledWith(overlays[0], cues('こんにちは'), cues('Hello'));
  });

  it('changing nativeLang refetches only the translation and reattaches', async () => {
    const { session, deps, overlays, detachers, fetchedKeys } = setup({ ...BOTH, 'ja>es': json3('Hola') });
    session.onNavigate('v1');
    await session.onMessage(urlMsg('v1'));
    await session.onMessage(tracksMsg('v1', [ja, en]));
    deps.fetchText.mockClear();
    await session.onSettings({ ...ON, nativeLang: 'es' });
    expect(fetchedKeys()).toEqual(['ja>es']);
    expect(detachers[0]).toHaveBeenCalledOnce();
    expect(deps.mountOverlay).toHaveBeenCalledOnce();
    expect(deps.attach).toHaveBeenLastCalledWith(overlays[0], cues('こんにちは'), cues('Hola'));
    expect(deps.attach).toHaveBeenCalledTimes(2);
  });

  it('changing nativeLang before the overlay is up re-runs selection with the new language', async () => {
    const { session, deps, overlays, fetchedKeys } = setup({ ja: json3('猫'), 'ja>es': json3('Gato') });
    session.onNavigate('v1');
    await session.onMessage(tracksMsg('v1', [ja, en]));
    await session.onSettings({ ...ON, nativeLang: 'es' });
    await session.onMessage(urlMsg('v1'));
    expect(fetchedKeys().sort()).toEqual(['ja', 'ja>es']);
    expect(deps.attach).toHaveBeenCalledWith(overlays[0], cues('猫'), cues('Gato'));
  });

  it('logs and stays inert when mountOverlay returns null', async () => {
    const { session, deps } = setup(BOTH);
    deps.mountOverlay.mockReturnValue(null);
    session.onNavigate('v1');
    await session.onMessage(urlMsg('v1'));
    await expect(session.onMessage(tracksMsg('v1', [ja, en]))).resolves.toBeUndefined();
    expect(deps.attach).not.toHaveBeenCalled();
    expect(deps.setNativeHidden).not.toHaveBeenCalledWith(true);
    expect(warned()).toBe(true);
  });

  it('logs and stays inert when mountOverlay throws', async () => {
    const { session, deps } = setup(BOTH);
    deps.mountOverlay.mockImplementation(() => {
      throw new Error('Extension context invalidated.');
    });
    session.onNavigate('v1');
    await session.onMessage(urlMsg('v1'));
    await expect(session.onMessage(tracksMsg('v1', [ja, en]))).resolves.toBeUndefined();
    expect(deps.setNativeHidden).not.toHaveBeenCalledWith(true);
  });

  it('never lets a throwing dep escape', async () => {
    const { session, deps, overlayMounted } = setup(BOTH);
    deps.send.mockImplementation(() => {
      throw new Error('send');
    });
    deps.attach.mockImplementation(() => {
      throw new Error('attach');
    });
    expect(() => session.onNavigate('v1')).not.toThrow();
    await session.onMessage(urlMsg('v1'));
    await expect(session.onMessage(tracksMsg('v1', [ja, en]))).resolves.toBeUndefined();
    expect(overlayMounted()).toBe(false);
    expect(deps.setNativeHidden).toHaveBeenLastCalledWith(false);

    deps.setNativeHidden.mockImplementation(() => {
      throw new Error('hide');
    });
    await expect(session.onSettings({ ...ON, youtubeDualSubs: false })).resolves.toBeUndefined();
    expect(() => session.teardown()).not.toThrow();
  });

  it('resolves a relative timedtext template against youtube.com', async () => {
    const { session, deps, overlays } = setup(BOTH);
    session.onNavigate('v1');
    await session.onMessage({ ...urlMsg('v1'), url: '/api/timedtext?v=v1&lang=ja&c=WEB' } as ToIsolated);
    await session.onMessage(tracksMsg('v1', [ja, en]));
    const urls = deps.fetchText.mock.calls.map(([u]) => u);
    expect(urls).toHaveLength(2);
    for (const url of urls) {
      expect(url.startsWith('https://www.youtube.com/api/timedtext?')).toBe(true);
      expect(new URL(url).searchParams.get('c')).toBe('WEB');
    }
    expect(deps.attach).toHaveBeenCalledWith(overlays[0], cues('こんにちは'), cues('Hello'));
  });

  it.each([
    'https://evil.example/api/timedtext?v=v1&lang=ja',
    'http://www.youtube.com/api/timedtext?v=v1&lang=ja',
    'https://www.youtube.com/redirect?v=v1&lang=ja',
  ])('logs and ignores a timedtext template outside youtube.com/api/timedtext: %s', async (url) => {
    const { session, deps } = setup(BOTH);
    session.onNavigate('v1');
    await session.onMessage(tracksMsg('v1', [ja, en]));
    await session.onMessage({ ...urlMsg('v1'), url } as ToIsolated);
    expect(warned()).toBe(true);
    expect(deps.fetchText).not.toHaveBeenCalled();
    expect(deps.attach).not.toHaveBeenCalled();
  });

  it('logs and ignores a malformed timedtext template', async () => {
    const { session, deps } = setup(BOTH);
    session.onNavigate('v1');
    await session.onMessage(tracksMsg('v1', [ja, en]));
    await expect(
      session.onMessage({ ...urlMsg('v1'), url: 'http://[' } as ToIsolated),
    ).resolves.toBeUndefined();
    expect(warned()).toBe(true);
    expect(deps.fetchText).not.toHaveBeenCalled();
    expect(deps.attach).not.toHaveBeenCalled();
  });

  it('teardown removes the overlay and ignores later messages', async () => {
    const { session, deps, overlayMounted, sent } = setup(BOTH);
    session.onNavigate('v1');
    await session.onMessage(urlMsg('v1'));
    await session.onMessage(tracksMsg('v1', [ja, en]));
    session.teardown();
    expect(overlayMounted()).toBe(false);
    expect(sent().at(-1)).toBe('restore-captions');
    expect(deps.setNativeHidden).toHaveBeenLastCalledWith(false);
    deps.attach.mockClear();
    await session.onMessage(tracksMsg('v1', [ja, en]));
    await session.onMessage(urlMsg('v1'));
    expect(deps.attach).not.toHaveBeenCalled();
  });
});
