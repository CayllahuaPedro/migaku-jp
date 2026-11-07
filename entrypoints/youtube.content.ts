import { DEFAULT_SETTINGS, getSettings, watchSettings, type Settings } from '../src/core/settings';
import { isToIsolated, watchVideoId } from '../src/surfaces/youtube/bridge';
import { setNativeHidden } from '../src/surfaces/youtube/page';
import { YoutubeSession } from '../src/surfaces/youtube/session';
import { SubtitleOverlay } from '../src/ui/SubtitleOverlay';
import { syncOverlay } from '../src/ui/SubtitleOverlay/sync';

const PLAYER_SELECTOR = '#movie_player';
const VIDEO_SELECTOR = '#movie_player video';

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) throw new Error(`timedtext request failed with ${response.status}`);
  return response.text();
}

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
  async main() {
    const session = new YoutubeSession(
      {
        fetchText,
        send: (msg) => window.postMessage(msg, location.origin),
        mountOverlay: () => {
          const player = document.querySelector<HTMLElement>(PLAYER_SELECTOR);
          if (!player || !document.querySelector(VIDEO_SELECTOR)) return null;
          return new SubtitleOverlay(player);
        },
        attach: (overlay, primary, secondary) => {
          const video = document.querySelector<HTMLVideoElement>(VIDEO_SELECTOR);
          if (!video) throw new Error('the player video element is gone');
          return syncOverlay(video, overlay, primary, secondary);
        },
        setNativeHidden,
      },
      await initialSettings(),
    );

    window.addEventListener('message', (event) => {
      if (event.source !== window || !isToIsolated(event.data)) return;
      session.onMessage(event.data).catch((error) => console.warn('[yabai-jp] bridge message failed', error));
    });
    watchSettings((settings) => {
      session.onSettings(settings).catch((error) => console.warn('[yabai-jp] settings update failed', error));
    });
    const navigate = () => session.onNavigate(watchVideoId(location.href));
    document.addEventListener('yt-navigate-finish', navigate);
    navigate();
  },
});
