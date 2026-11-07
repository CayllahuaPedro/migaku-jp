import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToIsolated } from '../src/surfaces/youtube/bridge';
import { MainWorldAgent, hookTimedtext, type YoutubePlayer } from '../src/surfaces/youtube/mainWorld';

const msg = <T extends object>(body: T) => ({ source: 'yabai-jp' as const, ...body });

describe('hookTimedtext', () => {
  function fakeTarget() {
    const fetch = vi.fn(async (..._args: unknown[]) => 'response');
    const open = vi.fn();
    class FakeXhr {}
    (FakeXhr.prototype as { open: unknown }).open = open;
    const target = { fetch, XMLHttpRequest: FakeXhr } as unknown as Parameters<typeof hookTimedtext>[0];
    const newXhr = () => new FakeXhr() as unknown as Pick<XMLHttpRequest, 'open'>;
    return { target, fetch, open, newXhr };
  }

  it('reports timedtext fetches for every input shape and passes the call through', async () => {
    const { target, fetch } = fakeTarget();
    const seen: string[] = [];
    hookTimedtext(target, (url) => seen.push(url));

    const init = { credentials: 'include' as const };
    await expect(target.fetch('/api/timedtext?v=a&lang=ja', init)).resolves.toBe('response');
    await target.fetch(new URL('https://www.youtube.com/api/timedtext?v=b'));
    await target.fetch({ url: 'https://www.youtube.com/api/timedtext?v=c' } as Request);
    await target.fetch('/youtubei/v1/player');

    expect(seen).toEqual([
      '/api/timedtext?v=a&lang=ja',
      'https://www.youtube.com/api/timedtext?v=b',
      'https://www.youtube.com/api/timedtext?v=c',
    ]);
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(fetch.mock.calls[0]).toEqual(['/api/timedtext?v=a&lang=ja', init]);
  });

  it('reports timedtext XHRs and forwards the exact arguments and receiver', () => {
    const { target, open, newXhr } = fakeTarget();
    const seen: string[] = [];
    hookTimedtext(target, (url) => seen.push(url));

    const xhr = newXhr();
    xhr.open('GET', '/api/timedtext?v=a');
    xhr.open('GET', new URL('https://www.youtube.com/youtubei/v1/next'));

    expect(seen).toEqual(['/api/timedtext?v=a']);
    expect(open.mock.calls[0]).toEqual(['GET', '/api/timedtext?v=a']);
    expect(open.mock.instances[0]).toBe(xhr);
  });

  it('never lets a failing callback break the page request', async () => {
    const { target, fetch, open, newXhr } = fakeTarget();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    hookTimedtext(target, () => {
      throw new Error('boom');
    });

    await expect(target.fetch('/api/timedtext?v=a')).resolves.toBe('response');
    newXhr().open('GET', '/api/timedtext?v=a');

    expect(fetch).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[yabai-jp]'), expect.any(Error));
    warn.mockRestore();
  });
});

const JA = { languageCode: 'ja' };
const JA_ASR = { languageCode: 'ja', kind: 'asr' as const };

function playerResponse(videoId: string) {
  return {
    videoDetails: { videoId, isLive: false },
    captions: { playerCaptionsTracklistRenderer: { captionTracks: [{ languageCode: 'ja', name: { simpleText: 'Japanese' } }] } },
  };
}

function setup(initialVideo: string | null = 'v1') {
  let videoId = initialVideo;
  let responseVideo = initialVideo ?? 'none';
  let captionsOption: unknown = {};
  const player = {
    getPlayerResponse: vi.fn(() => playerResponse(responseVideo)),
    getOption: vi.fn(() => captionsOption),
    setOption: vi.fn(),
    loadModule: vi.fn(),
    unloadModule: vi.fn(),
  } satisfies YoutubePlayer;
  let currentPlayer: YoutubePlayer | null = player;
  const posted: ToIsolated[] = [];
  const agent = new MainWorldAgent({
    getPlayer: () => currentPlayer,
    post: (m) => posted.push(m),
    currentVideoId: () => videoId,
  });
  return {
    agent,
    player,
    posted,
    navigate(id: string | null) {
      videoId = id;
    },
    serveResponseFor(id: string) {
      responseVideo = id;
    },
    setCaptionsOption(value: unknown) {
      captionsOption = value;
    },
    setPlayer(p: YoutubePlayer | null) {
      currentPlayer = p;
    },
  };
}

const tracksMsg = (videoId: string) =>
  msg({ type: 'tracks', videoId, tracks: [{ languageCode: 'ja', name: 'Japanese' }], isLive: false });

describe('MainWorldAgent', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    warn.mockRestore();
  });

  it('posts timedtext URLs tagged with the v param and skips URLs without one', () => {
    const { agent, posted } = setup();
    agent.onTimedtextUrl('/api/timedtext?v=v1&lang=ja');
    agent.onTimedtextUrl('/api/timedtext?lang=ja');
    expect(posted).toEqual([msg({ type: 'timedtext-url', videoId: 'v1', url: '/api/timedtext?v=v1&lang=ja' })]);
  });

  it('posts tracks on navigation once the player response matches the current video', () => {
    const t = setup('v1');
    t.navigate('v2');
    t.agent.onNavigate();
    expect(t.posted).toEqual([]);

    vi.advanceTimersByTime(250);
    expect(t.posted).toEqual([]);

    t.serveResponseFor('v2');
    vi.advanceTimersByTime(250);
    expect(t.posted).toEqual([tracksMsg('v2')]);

    vi.advanceTimersByTime(5000);
    expect(t.posted).toHaveLength(1);
  });

  it('gives up after about five seconds of a stale player response', () => {
    const t = setup('v1');
    t.navigate('v2');
    t.agent.onNavigate();
    vi.advanceTimersByTime(6000);
    t.serveResponseFor('v2');
    vi.advanceTimersByTime(1000);
    expect(t.posted).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[yabai-jp]'));
  });

  it('waits for a player that is not ready yet', () => {
    const t = setup('v1');
    const realPlayer = t.player;
    t.setPlayer({});
    t.agent.onNavigate();
    vi.advanceTimersByTime(250);
    t.setPlayer(realPlayer);
    vi.advanceTimersByTime(250);
    expect(t.posted).toEqual([tracksMsg('v1')]);
  });

  it('does not post tracks outside watch pages', () => {
    const t = setup(null);
    t.agent.onNavigate();
    t.agent.onMessage(msg({ type: 'request-state' }));
    vi.advanceTimersByTime(6000);
    expect(t.posted).toEqual([]);
    expect(t.player.getPlayerResponse).not.toHaveBeenCalled();
  });

  it('stops polling for a video the user already navigated away from', () => {
    const t = setup('v1');
    t.navigate('v2');
    t.agent.onNavigate();
    t.navigate('v3');
    t.serveResponseFor('v2');
    vi.advanceTimersByTime(6000);
    expect(t.posted).toEqual([]);
  });

  it('replays the latest timedtext URL and tracks for the current video on request-state', () => {
    const t = setup('v1');
    t.agent.onTimedtextUrl('/api/timedtext?v=v1&lang=ja');
    t.agent.onNavigate();
    t.posted.length = 0;
    t.player.getPlayerResponse.mockClear();

    t.agent.onMessage(msg({ type: 'request-state' }));

    expect(t.posted).toEqual([
      msg({ type: 'timedtext-url', videoId: 'v1', url: '/api/timedtext?v=v1&lang=ja' }),
      tracksMsg('v1'),
    ]);
    expect(t.player.getPlayerResponse).not.toHaveBeenCalled();
  });

  it('reads the player response on request-state when no tracks are cached for the current video', () => {
    const t = setup('v1');
    t.agent.onTimedtextUrl('/api/timedtext?v=v1&lang=ja');
    t.agent.onNavigate();
    t.navigate('v2');
    t.serveResponseFor('v2');
    t.posted.length = 0;

    t.agent.onMessage(msg({ type: 'request-state' }));

    expect(t.posted).toEqual([tracksMsg('v2')]);
  });

  it('remembers the prior caption track once and forces the Japanese track', () => {
    const t = setup('v1');
    const prior = { languageCode: 'en', kind: '', name: 'English' };
    t.setCaptionsOption(prior);

    t.agent.onMessage(msg({ type: 'ensure-captions', track: JA_ASR }));
    t.setCaptionsOption({ languageCode: 'ja', kind: 'asr' });
    t.agent.onMessage(msg({ type: 'ensure-captions', track: JA_ASR }));

    expect(t.player.loadModule).toHaveBeenCalledWith('captions');
    expect(t.player.setOption).toHaveBeenLastCalledWith('captions', 'track', { languageCode: 'ja', kind: 'asr' });

    t.player.setOption.mockClear();
    t.agent.onMessage(msg({ type: 'restore-captions' }));
    expect(t.player.setOption).toHaveBeenCalledWith('captions', 'track', prior);
    expect(t.player.unloadModule).not.toHaveBeenCalled();
  });

  it('omits kind for a human Japanese track', () => {
    const t = setup('v1');
    t.agent.onMessage(msg({ type: 'ensure-captions', track: JA }));
    expect(t.player.setOption).toHaveBeenCalledWith('captions', 'track', { languageCode: 'ja' });
  });

  it('unloads captions on restore when they were off before, then forgets', () => {
    const t = setup('v1');
    t.setCaptionsOption({});
    t.agent.onMessage(msg({ type: 'ensure-captions', track: JA }));
    t.agent.onMessage(msg({ type: 'restore-captions' }));
    t.agent.onMessage(msg({ type: 'restore-captions' }));

    expect(t.player.unloadModule).toHaveBeenCalledOnce();
    expect(t.player.unloadModule).toHaveBeenCalledWith('captions');
  });

  it('ignores restore when nothing was remembered', () => {
    const t = setup('v1');
    t.agent.onMessage(msg({ type: 'restore-captions' }));
    expect(t.player.setOption).not.toHaveBeenCalled();
    expect(t.player.unloadModule).not.toHaveBeenCalled();
  });

  it('restores the previous video state even after navigation already happened', () => {
    const t = setup('v1');
    t.setCaptionsOption({});
    t.agent.onMessage(msg({ type: 'ensure-captions', track: JA }));
    t.navigate('v2');
    t.agent.onNavigate();

    t.agent.onMessage(msg({ type: 'restore-captions' }));
    expect(t.player.unloadModule).toHaveBeenCalledWith('captions');

    const prior = { languageCode: 'en', kind: '' };
    t.setCaptionsOption(prior);
    t.agent.onMessage(msg({ type: 'ensure-captions', track: JA }));
    t.player.setOption.mockClear();
    t.agent.onMessage(msg({ type: 'restore-captions' }));
    expect(t.player.setOption).toHaveBeenCalledWith('captions', 'track', prior);
  });

  it('logs and survives player calls that throw or a missing player', () => {
    const t = setup('v1');
    t.player.getOption.mockImplementation(() => {
      throw new Error('not ready');
    });
    t.player.setOption.mockImplementation(() => {
      throw new Error('nope');
    });

    expect(() => t.agent.onMessage(msg({ type: 'ensure-captions', track: JA }))).not.toThrow();
    expect(() => t.agent.onMessage(msg({ type: 'restore-captions' }))).not.toThrow();
    expect(t.player.unloadModule).toHaveBeenCalledWith('captions');

    t.setPlayer(null);
    expect(() => t.agent.onMessage(msg({ type: 'ensure-captions', track: JA }))).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[yabai-jp]'), expect.anything());
  });
});
