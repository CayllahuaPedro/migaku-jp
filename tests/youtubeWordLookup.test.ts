import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WordLookup, type VideoLike } from '../src/surfaces/youtube/wordLookup';
import type { LookupResult } from '../src/core/messages';

const anchor = { top: 500, bottom: 516, left: 10, right: 40 } as DOMRect;
const word = (basicForm: string) => ({ surface: basicForm, basicForm, reading: 'よみ' });
const result = (gloss: string): LookupResult => ({
  accentPos: 1,
  posTags: {},
  entries: [
    {
      id: gloss,
      kanji: [gloss],
      kana: ['x'],
      forms: [gloss],
      senses: [{ pos: ['n'], gloss: [gloss] }],
    },
  ],
});

function fakeVideo(paused = false) {
  const video = new EventTarget() as VideoLike & { play: ReturnType<typeof vi.fn> };
  video.paused = paused;
  video.pause = vi.fn(() => {
    video.paused = true;
    video.dispatchEvent(new Event('pause'));
  });
  video.play = vi.fn(() => {
    video.paused = false;
    video.dispatchEvent(new Event('play'));
  });
  return video;
}

function setup(opts: { paused?: boolean; pauseEnabled?: boolean; lookup?: (w: any) => Promise<LookupResult> } = {}) {
  const container = document.createElement('div');
  document.body.append(container);
  const video = fakeVideo(opts.paused);
  const lookup = vi.fn(opts.lookup ?? (async (w) => result(w.basicForm)));
  const wl = new WordLookup({
    container,
    video,
    lookup,
    pauseEnabled: () => opts.pauseEnabled ?? true,
  });
  const popupRoot = () =>
    container.querySelector('[data-mjp-lookup] .mjp-popup-host')!.shadowRoot!;
  const shown = () => popupRoot().querySelector('.mjp-popup');
  return { container, video, lookup, wl, shown, popupRoot };
}

const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('WordLookup', () => {
  it('passes parts to lookup and part results to the popup', async () => {
    const parts = [{ surface: '食肉', basicForm: '食肉', reading: 'ショクニク' }];
    const { wl, lookup, popupRoot } = setup({
      lookup: async (w) => ({ ...result(w.basicForm), parts: [{ word: '食肉', entries: [] }] }),
    });
    const w = { ...word('食肉目'), parts };
    await wl.open(w, anchor);
    expect(lookup).toHaveBeenCalledWith(expect.objectContaining({ parts }));
    expect(popupRoot().textContent).toContain('Partes');
    expect(popupRoot().querySelector('.mjp-parts')!.textContent).toContain('食肉');
  });

  it('opening pauses a playing video when enabled and shows the popup above the word', async () => {
    const { video, wl, shown, popupRoot } = setup();
    const spy = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(100);
    const p = wl.open(word('猫'), anchor);
    expect(video.pause).toHaveBeenCalledTimes(1);
    await p;
    expect(shown()).not.toBeNull();
    expect(popupRoot().textContent).toContain('猫');
    expect((shown() as HTMLElement).style.top).toBe('392px');
    spy.mockRestore();
  });

  it('does not pause when disabled or when the video is already paused', async () => {
    const a = setup({ pauseEnabled: false });
    await a.wl.open(word('猫'), anchor);
    expect(a.video.pause).not.toHaveBeenCalled();
    const b = setup({ paused: true });
    await b.wl.open(word('猫'), anchor);
    expect(b.video.pause).not.toHaveBeenCalled();
    b.wl.close();
    await flush();
    expect(b.video.play).not.toHaveBeenCalled();
  });

  it('closing resumes only a video the extension paused', async () => {
    const { video, wl, shown } = setup();
    await wl.open(word('猫'), anchor);
    wl.close();
    expect(shown()).toBeNull();
    expect(video.play).not.toHaveBeenCalled();
    await flush();
    expect(video.play).toHaveBeenCalledTimes(1);
  });

  it('warns instead of leaving an unhandled rejection when resuming fails', async () => {
    const { video, wl } = setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = new DOMException('interrupted', 'AbortError');
    video.play.mockImplementation(() => Promise.reject(error));
    await wl.open(word('猫'), anchor);
    wl.close();
    await flush();
    await flush();
    expect(warn).toHaveBeenCalledWith('[yabai-jp] resume failed', error);
    warn.mockRestore();
  });

  it('does not resume after the user pressed play while open', async () => {
    const { video, wl } = setup();
    await wl.open(word('猫'), anchor);
    video.play();
    video.pause();
    video.play.mockClear();
    wl.close();
    await flush();
    expect(video.play).not.toHaveBeenCalled();
  });

  it('does not call play if something else resumed the video before the deferred check', async () => {
    const { video, wl } = setup();
    await wl.open(word('猫'), anchor);
    wl.close();
    video.paused = false;
    await flush();
    expect(video.play).not.toHaveBeenCalled();
  });

  it('a stale lookup result never shows', async () => {
    const resolvers: Record<string, (r: LookupResult) => void> = {};
    const { wl, popupRoot } = setup({
      lookup: (w) => new Promise((res) => (resolvers[w.basicForm] = res)),
    });
    const a = wl.open(word('alpha'), anchor);
    const b = wl.open(word('beta'), anchor);
    resolvers.beta(result('beta'));
    await b;
    resolvers.alpha(result('alpha'));
    await a;
    expect(popupRoot().textContent).toContain('beta');
    expect(popupRoot().textContent).not.toContain('alpha');
  });

  it('a lookup resolving after close or dispose never shows', async () => {
    let resolve!: (r: LookupResult) => void;
    const first = setup({ lookup: () => new Promise((r) => (resolve = r)) });
    const p1 = first.wl.open(word('猫'), anchor);
    first.wl.close();
    resolve(result('猫'));
    await p1;
    expect(first.shown()).toBeNull();

    const second = setup({ lookup: () => new Promise((r) => (resolve = r)) });
    const p2 = second.wl.open(word('猫'), anchor);
    const root = second.popupRoot();
    second.wl.dispose();
    resolve(result('猫'));
    await p2;
    expect(root.querySelector('.mjp-popup')).toBeNull();
  });

  it('Escape and outside click close; clicks inside the popup do not', async () => {
    const { container, wl, shown } = setup();
    await wl.open(word('猫'), anchor);
    container.querySelector('[data-mjp-lookup]')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true, composed: true }),
    );
    expect(shown()).not.toBeNull();
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(shown()).toBeNull();

    await wl.open(word('猫'), anchor);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(shown()).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(shown()).toBeNull();
  });

  it('clicking another word while open does not close or resume', async () => {
    const { video, wl, shown } = setup();
    await wl.open(word('猫'), anchor);
    const host = document.createElement('div');
    document.body.append(host);
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<span class="mjp-token">犬</span>';
    root.querySelector('.mjp-token')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true, composed: true }),
    );
    await flush();
    expect(shown()).not.toBeNull();
    expect(video.play).not.toHaveBeenCalled();
    await wl.open(word('犬'), anchor);
    wl.close();
    await flush();
    expect(video.play).toHaveBeenCalledTimes(1);
  });

  it('closes on an outside click that the player stops from bubbling', async () => {
    const { container, wl, shown } = setup();
    await wl.open(word('猫'), anchor);
    const other = document.createElement('div');
    other.addEventListener('click', (e) => e.stopPropagation());
    document.body.append(other);
    other.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(shown()).toBeNull();
    expect(container.isConnected).toBe(true);
  });

  it('dispose removes the popup host, document listeners, and never resumes', async () => {
    const { container, video, wl } = setup();
    await wl.open(word('猫'), anchor);
    wl.dispose();
    expect(container.querySelector('[data-mjp-lookup]')).toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flush();
    expect(video.play).not.toHaveBeenCalled();
  });

  it('a failed lookup keeps the popup hidden, warns, and resumes a video it paused', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { video, wl, shown } = setup({ lookup: async () => Promise.reject(new Error('boom')) });
    await wl.open(word('猫'), anchor);
    expect(shown()).toBeNull();
    expect(warn).toHaveBeenCalledWith('[yabai-jp] lookup failed', expect.any(Error));
    await flush();
    expect(video.play).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('close then dispose before timers: play not called', async () => {
    const { video, wl } = setup();
    await wl.open(word('猫'), anchor);
    wl.close();
    wl.dispose();
    await flush();
    expect(video.play).not.toHaveBeenCalled();
  });

  it('close then open before timers: play not called, and closing again resumes once', async () => {
    const { video, wl } = setup();
    await wl.open(word('猫'), anchor);
    wl.close();
    await wl.open(word('犬'), anchor);
    await flush();
    expect(video.play).not.toHaveBeenCalled();
    wl.close();
    await flush();
    expect(video.play).toHaveBeenCalledTimes(1);
  });
});
