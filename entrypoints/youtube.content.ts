import {
  isErrorResult,
  type AnnotateResult,
  type ErrorResult,
  type LookupResult,
  type TokenQuery,
} from '../src/core/messages';
import { initTokenizer, tokenize } from '../src/core/tokenizer';
import { DEFAULT_SETTINGS, getSettings, watchSettings, type Settings } from '../src/core/settings';
import { isToIsolated, watchVideoId } from '../src/surfaces/youtube/bridge';
import { setNativeHidden } from '../src/surfaces/youtube/page';
import { CueAnnotator, createEngineReady } from '../src/surfaces/youtube/cueAnnotator';
import { YoutubeSession } from '../src/surfaces/youtube/session';
import { WordLookup } from '../src/surfaces/youtube/wordLookup';
import { SubtitleOverlay, type WordRef } from '../src/ui/SubtitleOverlay';
import { syncOverlay } from '../src/ui/SubtitleOverlay/sync';

const PLAYER_SELECTOR = '#movie_player';
const VIDEO_SELECTOR = '#movie_player video';
const OVERLAY_OPTIONS = { controlsHiddenClass: 'ytp-autohide', suppressedClass: 'ad-showing' };

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) throw new Error(`timedtext request failed with ${response.status}`);
  return response.text();
}

async function send<T>(message: object): Promise<T> {
  const res = (await browser.runtime.sendMessage(message)) as T | ErrorResult;
  if (isErrorResult(res)) throw new Error(res.error);
  return res;
}

const engineReady = createEngineReady(
  async () => {
    await send({ type: 'ensure-imported' });
  },
  () => initTokenizer(new URL('kuromoji/', browser.runtime.getURL('/popup.html')).href),
);

const annotate = (tokens: TokenQuery[]) => send<AnnotateResult>({ type: 'annotate', tokens });
const lookup = (word: WordRef) => send<LookupResult>({ type: 'lookup', ...word });

async function initialSettings(): Promise<Settings> {
  try {
    return await getSettings();
  } catch (error) {
    console.warn('[yabai-jp] could not read settings, using defaults', error);
    return DEFAULT_SETTINGS;
  }
}

export default defineContentScript({
  matches: ['*://www.youtube.com/*'],
  async main(ctx) {
    let currentSettings = await initialSettings();
    const session = new YoutubeSession(
      {
        fetchText,
        send: (msg) => window.postMessage(msg, location.origin),
        mountOverlay: () => {
          const player = document.querySelector<HTMLElement>(PLAYER_SELECTOR);
          if (!player || !document.querySelector(VIDEO_SELECTOR)) return null;
          const video = document.querySelector<HTMLVideoElement>(VIDEO_SELECTOR);
          if (!video) return null;
          const wordLookup = new WordLookup({
            container: player,
            video,
            lookup,
            pauseEnabled: () => currentSettings.pauseOnLookup,
          });
          return new SubtitleOverlay(player, {
            ...OVERLAY_OPTIONS,
            onWordClick: (word, anchor) => void wordLookup.open(word, anchor),
            onSuppressed: () => wordLookup.close(),
            onDestroy: () => wordLookup.dispose(),
          });
        },
        attach: (overlay, primary, secondary) => {
          const video = document.querySelector<HTMLVideoElement>(VIDEO_SELECTOR);
          if (!video) throw new Error('the player video element is gone');
          const annotator = new CueAnnotator({ ready: engineReady, tokenize, annotate });
          annotator.prepare(primary.map((cue) => cue.text));
          const detach = syncOverlay(video, overlay, primary, secondary, annotator);
          return () => {
            detach();
            annotator.dispose();
          };
        },
        setNativeHidden,
      },
      currentSettings,
    );

    ctx.addEventListener(window, 'message', (event) => {
      if (event.source !== window || !isToIsolated(event.data)) return;
      session.onMessage(event.data).catch((error) => console.warn('[yabai-jp] bridge message failed', error));
    });
    const unwatchSettings = watchSettings((settings) => {
      currentSettings = settings;
      session.onSettings(settings).catch((error) => console.warn('[yabai-jp] settings update failed', error));
    });
    const navigate = () => session.onNavigate(watchVideoId(location.href));
    ctx.addEventListener(document, 'yt-navigate-start', () => session.onNavigate(null));
    ctx.addEventListener(document, 'yt-navigate-finish', navigate);
    ctx.onInvalidated(() => {
      unwatchSettings();
      session.teardown();
    });
    navigate();
  },
});
