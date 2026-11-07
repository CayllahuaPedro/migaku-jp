import { isToMain, watchVideoId } from '../src/surfaces/youtube/bridge';
import { MainWorldAgent, hookTimedtext, type YoutubePlayer } from '../src/surfaces/youtube/mainWorld';

export default defineContentScript({
  matches: ['*://www.youtube.com/*'],
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    const agent = new MainWorldAgent({
      getPlayer: () => document.getElementById('movie_player') as YoutubePlayer | null,
      post: (msg) => window.postMessage(msg, location.origin),
      currentVideoId: () => watchVideoId(location.href),
    });

    hookTimedtext(window, (url) => agent.onTimedtextUrl(url));
    document.addEventListener('yt-navigate-finish', () => agent.onNavigate());
    window.addEventListener('message', (event) => {
      if (event.source !== window || !isToMain(event.data)) return;
      agent.onMessage(event.data);
    });
  },
});
