import { activeCue, type Cue } from '../../core/cues';
import type { RenderToken } from '../../core/annotate';
import type { LineTokens } from '../../surfaces/youtube/cueAnnotator';
import type { SubtitleOverlay } from './index';

export function syncOverlay(
  video: HTMLVideoElement,
  overlay: SubtitleOverlay,
  primary: Cue[],
  secondary: Cue[],
  tokens?: LineTokens,
): () => void {
  let lastPrimary: string | null | undefined;
  let lastSecondary: string | null | undefined;
  let lastTokens: RenderToken[] | null = null;
  let frame = 0;

  const update = () => {
    const nextPrimary = activeCue(primary, video.currentTime)?.text ?? null;
    const nextSecondary = activeCue(secondary, video.currentTime)?.text ?? null;
    const nextTokens = (nextPrimary !== null && tokens?.get(nextPrimary)) || null;
    if (nextPrimary === lastPrimary && nextSecondary === lastSecondary && nextTokens === lastTokens) return;
    lastPrimary = nextPrimary;
    lastSecondary = nextSecondary;
    lastTokens = nextTokens;
    overlay.setLines(nextPrimary, nextSecondary, nextTokens);
  };

  const tick = () => {
    update();
    if (!video.paused) frame = requestAnimationFrame(tick);
  };
  const onPlay = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(tick);
  };

  const unsubscribe = tokens?.onChange(update);
  update();
  video.addEventListener('timeupdate', update);
  video.addEventListener('seeked', update);
  video.addEventListener('play', onPlay);
  if (!video.paused) onPlay();

  return () => {
    cancelAnimationFrame(frame);
    unsubscribe?.();
    video.removeEventListener('timeupdate', update);
    video.removeEventListener('seeked', update);
    video.removeEventListener('play', onPlay);
  };
}
