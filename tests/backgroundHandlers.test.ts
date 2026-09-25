import 'fake-indexeddb/auto';
import { describe, it, expect, beforeAll } from 'vitest';
import { openDb } from '../src/core/db';
import { handleBackgroundMessage } from '../src/core/backgroundHandlers';
import type { DictEntry } from '../src/core/types';
import type { LookupResult } from '../src/core/messages';

const assets = {
  entries: [
    {
      id: '1',
      kanji: ['飼う'],
      kana: ['かう'],
      forms: ['飼う', 'かう'],
      senses: [{ pos: ['v5u'], gloss: ['to keep (a pet)'] }],
    },
  ] as DictEntry[],
  pitch: { '飼う|かう': 1, 飼う: 1 },
};
const loadAssets = async () => assets;
const loadPosTags = async () => ({
  v5u: "Godan verb with 'u' ending",
  n: 'noun (common) (futsuumeishi)',
});

describe('handleBackgroundMessage', () => {
  let db: IDBDatabase;
  beforeAll(async () => {
    db = await openDb();
  });

  it('ensure-imported imports once', async () => {
    const ensure = () =>
      handleBackgroundMessage(db, { type: 'ensure-imported' }, loadAssets, loadPosTags);
    expect(await ensure()).toEqual({ ok: true });
    expect(await ensure()).toEqual({ ok: true });
  });

  it('annotate returns accents per token (reading in katakana)', async () => {
    const res = await handleBackgroundMessage(
      db,
      {
        type: 'annotate',
        tokens: [
          { basicForm: '飼う', surface: '飼っ', reading: 'カッ' },
          { basicForm: '謎', surface: '謎', reading: 'ナゾ' },
        ],
      },
      loadAssets,
      loadPosTags,
    );
    expect(res).toEqual({ accents: [1, null] });
  });

  it('lookup returns entries, accent and the descriptions of their pos tags', async () => {
    const res = (await handleBackgroundMessage(
      db,
      { type: 'lookup', basicForm: '飼う', surface: '飼っ', reading: 'カッ' },
      loadAssets,
      loadPosTags,
    )) as LookupResult;
    expect(res.entries[0].senses[0].gloss).toEqual(['to keep (a pet)']);
    expect(res.accentPos).toBe(1);
    expect(res.posTags).toEqual({ v5u: "Godan verb with 'u' ending" });
  });
});
