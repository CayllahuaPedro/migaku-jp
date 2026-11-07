import { describe, expect, it } from 'vitest';
import { activeCue } from '../src/core/cues';

const cues = [
  { start: 0, end: 2, text: 'a' },
  { start: 1.5, end: 4, text: 'b' },
  { start: 6, end: 8, text: 'c' },
];

describe('activeCue', () => {
  it('returns the latest-starting cue covering the time', () => expect(activeCue(cues, 1.8)?.text).toBe('b'));
  it('returns null in gaps', () => expect(activeCue(cues, 5)).toBeNull());
  it('end is exclusive', () => expect(activeCue(cues, 8)).toBeNull());
  it('works after seeking backwards', () => {
    activeCue(cues, 7);
    expect(activeCue(cues, 0.5)?.text).toBe('a');
  });
  it('returns null for empty cues', () => expect(activeCue([], 1)).toBeNull());
});
