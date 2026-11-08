import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CueAnnotator,
  createEngineReady,
  type CueAnnotatorDeps,
} from '../src/surfaces/youtube/cueAnnotator';
import type { JpToken } from '../src/core/tokenizer';

const neko: JpToken = { surface: '猫', reading: 'ネコ', basicForm: '猫', pos: '名詞' };

const settle = () => new Promise<void>((r) => setTimeout(r, 0));

function makeDeps(overrides: Partial<CueAnnotatorDeps> = {}): CueAnnotatorDeps {
  return {
    ready: async () => true,
    tokenize: async () => [neko],
    annotate: async () => ({ accents: [1] }),
    ...overrides,
  };
}

afterEach(() => vi.restoreAllMocks());

describe('CueAnnotator', () => {
  it('get returns null until a prepared text is annotated, then its RenderTokens', async () => {
    const annotator = new CueAnnotator(makeDeps());
    annotator.prepare(['猫']);
    expect(annotator.get('猫')).toBeNull();
    await settle();
    expect(annotator.get('猫')).toEqual([
      expect.objectContaining({ surface: '猫', pattern: 'atamadaka' }),
    ]);
  });

  it('get returns null for a text that was never prepared', async () => {
    const tokenize = vi.fn(async () => [neko]);
    const annotator = new CueAnnotator(makeDeps({ tokenize }));
    expect(annotator.get('x')).toBeNull();
    await settle();
    expect(tokenize).not.toHaveBeenCalled();
  });

  it('notifies subscribers after each annotated text and stops after unsubscribe', async () => {
    const annotator = new CueAnnotator(makeDeps());
    const cb = vi.fn();
    const off = annotator.onChange(cb);
    annotator.prepare(['a', 'b']);
    await settle();
    expect(cb).toHaveBeenCalledTimes(2);
    off();
    annotator.prepare(['c']);
    await settle();
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('annotates prepared texts one at a time in order, deduplicated', async () => {
    const order: string[] = [];
    const annotator = new CueAnnotator(
      makeDeps({
        tokenize: async (t) => {
          order.push(t);
          return [neko];
        },
      }),
    );
    annotator.prepare(['a', 'b', 'a', 'c']);
    await settle();
    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('get on a pending text moves it to the front of the queue', async () => {
    const order: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const annotator = new CueAnnotator(
      makeDeps({
        tokenize: async (t) => {
          order.push(t);
          if (t === 'a') await gate;
          return [neko];
        },
      }),
    );
    annotator.prepare(['a', 'b', 'c']);
    await settle();
    expect(annotator.get('c')).toBeNull();
    release();
    await settle();
    expect(order).toEqual(['a', 'c', 'b']);
  });

  it('does nothing when ready resolves false', async () => {
    const tokenize = vi.fn(async () => [neko]);
    const annotator = new CueAnnotator(makeDeps({ ready: async () => false, tokenize }));
    annotator.prepare(['a']);
    await settle();
    expect(tokenize).not.toHaveBeenCalled();
    expect(annotator.get('a')).toBeNull();
  });

  it('does not leak a rejection when ready rejects', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const annotator = new CueAnnotator(
      makeDeps({ ready: () => Promise.reject(new Error('boom')) }),
    );
    annotator.prepare(['a']);
    await settle();
    expect(annotator.get('a')).toBeNull();
  });

  it('a failing text stays null, others continue, warns once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const annotator = new CueAnnotator(
      makeDeps({
        tokenize: async (t) => [{ ...neko, surface: t }],
        annotate: async (tokens) => {
          if (['b', 'd'].includes(tokens[0].surface)) throw new Error('nope');
          return { accents: [1] };
        },
      }),
    );
    annotator.prepare(['a', 'b', 'c', 'd']);
    await settle();
    expect(annotator.get('a')).not.toBeNull();
    expect(annotator.get('b')).toBeNull();
    expect(annotator.get('c')).not.toBeNull();
    expect(annotator.get('d')).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('[yabai-jp]');
  });

  it('dispose stops processing and notifications', async () => {
    const order: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const annotator = new CueAnnotator(
      makeDeps({
        tokenize: async (t) => {
          order.push(t);
          await gate;
          return [neko];
        },
      }),
    );
    const cb = vi.fn();
    annotator.onChange(cb);
    annotator.prepare(['a', 'b']);
    await settle();
    annotator.dispose();
    release();
    await settle();
    expect(order).toEqual(['a']);
    expect(cb).not.toHaveBeenCalled();
    expect(annotator.get('a')).toBeNull();
  });
});

describe('createEngineReady', () => {
  it('attempts once and resolves false without rejecting on failure', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ensureImported = vi.fn(() => Promise.reject(new Error('x')));
    const initTokenizer = vi.fn(async () => {});
    const ready = createEngineReady(ensureImported, initTokenizer);
    await expect(ready()).resolves.toBe(false);
    await expect(ready()).resolves.toBe(false);
    expect(ensureImported).toHaveBeenCalledTimes(1);
    expect(initTokenizer).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('[yabai-jp]');
  });

  it('resolves true after importing then initialising the tokenizer', async () => {
    const calls: string[] = [];
    const ready = createEngineReady(
      async () => void calls.push('import'),
      async () => void calls.push('init'),
    );
    await expect(ready()).resolves.toBe(true);
    await ready();
    expect(calls).toEqual(['import', 'init']);
  });
});
