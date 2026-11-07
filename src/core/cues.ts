export interface Cue {
  start: number;
  end: number;
  text: string;
}

export function activeCue(cues: Cue[], time: number): Cue | null {
  let low = 0;
  let high = cues.length - 1;
  let lastStarted = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (cues[mid].start <= time) {
      lastStarted = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  for (let i = lastStarted; i >= 0; i--) {
    if (time < cues[i].end) return cues[i];
  }
  return null;
}
