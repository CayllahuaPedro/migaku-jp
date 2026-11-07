import { activeCue, type Cue } from '../../core/cues';
import type { SubtitleOverlay } from './index';

export function syncOverlay(
  video: HTMLVideoElement,
  overlay: SubtitleOverlay,
  primary: Cue[],
  secondary: Cue[],
): () => void {
  let lastPrimary: string | null = null;
  let lastSecondary: string | null = null;
  let frame = 0;

  const update = () => {
    const nextPrimary = activeCue(primary, video.currentTime)?.text ?? null;
    const nextSecondary = activeCue(secondary, video.currentTime)?.text ?? null;
    if (nextPrimary === lastPrimary && nextSecondary === lastSecondary) return;
    lastPrimary = nextPrimary;
    lastSecondary = nextSecondary;
    overlay.setLines(nextPrimary, nextSecondary);
  };

  const tick = () => {
    update();
    if (!video.paused) frame = requestAnimationFrame(tick);
  };
  const onPlay = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(tick);
  };

  video.addEventListener('timeupdate', update);
  video.addEventListener('seeked', update);
  video.addEventListener('play', onPlay);
  if (!video.paused) onPlay();

  return () => {
    cancelAnimationFrame(frame);
    video.removeEventListener('timeupdate', update);
    video.removeEventListener('seeked', update);
    video.removeEventListener('play', onPlay);
  };
}
