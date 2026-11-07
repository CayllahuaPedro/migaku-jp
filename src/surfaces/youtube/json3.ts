import type { Cue } from '../../core/cues';

interface Json3Event {
  tStartMs?: number;
  dDurationMs?: number;
  segs?: { utf8?: string }[];
}

export function parseJson3(raw: string): Cue[] {
  let events: Json3Event[];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.events)) return [];
    events = parsed.events;
  } catch {
    return [];
  }
  const cues: Cue[] = [];
  for (const event of events) {
    if (!event.segs || typeof event.tStartMs !== 'number') continue;
    const text = event.segs.map((seg) => seg.utf8 ?? '').join('').trim();
    const duration = event.dDurationMs ?? 0;
    if (!/[\p{L}\p{N}]/u.test(text) || duration <= 0) continue;
    cues.push({ start: event.tStartMs / 1000, end: (event.tStartMs + duration) / 1000, text });
  }
  return cues.sort((a, b) => a.start - b.start);
}
