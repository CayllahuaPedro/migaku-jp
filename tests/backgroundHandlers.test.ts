import 'fake-indexeddb/auto';
import { describe, it, expect, beforeAll } from 'vitest';
import { openDb } from '../src/core/db';
import { handleBackgroundMessage } from '../src/core/backgroundHandlers';
import type { DictEntry } from '../src/core/types';

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

describe('handleBackgroundMessage', () => {
  let db: IDBDatabase;
  beforeAll(async () => {
    db = await openDb();
  });

  it('ensure-imported imports once', async () => {
    expect(await handleBackgroundMessage(db, { type: 'ensure-imported' }, loadAssets))
      .toEqual({ ok: true });
    expect(await handleBackgroundMessage(db, { type: 'ensure-imported' }, loadAssets))
      .toEqual({ ok: true });
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
    );
    expect(res).toEqual({ accents: [1, null] });
  });

  it('lookup returns entries and accent', async () => {
    const res = (await handleBackgroundMessage(
      db,
      { type: 'lookup', basicForm: '飼う', surface: '飼っ', reading: 'カッ' },
      loadAssets,
    )) as { entries: DictEntry[]; accentPos: number | null };
    expect(res.entries[0].senses[0].gloss).toEqual(['to keep (a pet)']);
    expect(res.accentPos).toBe(1);
  });
});
