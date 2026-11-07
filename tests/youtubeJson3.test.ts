import { describe, expect, it } from 'vitest';
import { parseJson3 } from '../src/surfaces/youtube/json3';

describe('parseJson3', () => {
  it('converts events to cues in seconds joining segs', () =>
    expect(parseJson3(JSON.stringify({ events: [
      { tStartMs: 1000, dDurationMs: 2500, segs: [{ utf8: 'こん' }, { utf8: 'にちは' }] },
    ] }))).toEqual([{ start: 1, end: 3.5, text: 'こんにちは' }]));

  it('drops window events without segs and whitespace-only events', () =>
    expect(parseJson3(JSON.stringify({ events: [
      { tStartMs: 0, dDurationMs: 9000, id: 1, wpWinPosId: 1 },
      { tStartMs: 500, dDurationMs: 100, aAppend: 1, segs: [{ utf8: '\n' }] },
      { tStartMs: 600, dDurationMs: 1000, segs: [{ utf8: ' はい ' }] },
    ] }))).toEqual([{ start: 0.6, end: 1.6, text: 'はい' }]));

  it('returns [] for empty or invalid input', () => {
    expect(parseJson3('')).toEqual([]);
    expect(parseJson3('{"foo":1}')).toEqual([]);
    expect(parseJson3('not json')).toEqual([]);
  });

  it('drops events without duration', () =>
    expect(parseJson3(JSON.stringify({ events: [
      { tStartMs: 100, segs: [{ utf8: 'あ' }] },
    ] }))).toEqual([]));

  it('sorts cues by start', () =>
    expect(parseJson3(JSON.stringify({ events: [
      { tStartMs: 2000, dDurationMs: 500, segs: [{ utf8: 'b' }] },
      { tStartMs: 1000, dDurationMs: 500, segs: [{ utf8: 'a' }] },
    ] })).map((c) => c.text)).toEqual(['a', 'b']));
});
