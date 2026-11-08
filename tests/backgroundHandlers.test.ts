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
    {
      id: '2',
      kanji: ['食肉目'],
      kana: ['しょくにくもく'],
      forms: ['食肉目', 'しょくにくもく'],
      senses: [{ pos: ['n'], gloss: ['Carnivora'] }],
    },
    {
      id: '3',
      kanji: ['食肉'],
      kana: ['しょくにく'],
      forms: ['食肉', 'しょくにく'],
      senses: [{ pos: ['n'], gloss: ['meat'] }],
    },
    {
      id: '4',
      kanji: [],
      kana: ['ことば'],
      forms: ['ことば'],
      senses: [{ pos: ['n'], gloss: ['word'] }],
    },
    {
      id: '5',
      kanji: [],
      kana: ['コンピューターウイルス', 'コンピュータウイルス'],
      forms: ['コンピューターウイルス', 'コンピュータウイルス'],
      senses: [{ pos: ['n'], gloss: ['computer virus'] }],
    },
    {
      id: '6',
      kanji: ['目'],
      kana: ['もく'],
      forms: ['目', 'もく'],
      senses: [{ pos: ['n'], gloss: ['order (taxonomy)'] }],
    },
    {
      id: '7',
      kanji: ['目'],
      kana: ['め'],
      forms: ['目', 'め'],
      senses: [{ pos: ['n'], gloss: ['eye'] }],
    },
  ] as DictEntry[],
  pitch: { '飼う|かう': 1, 飼う: 1, '食肉目|しょくにくもく': 4 },
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

  it('find-compounds returns existing forms with their JMdict reading', async () => {
    const res = await handleBackgroundMessage(
      db,
      { type: 'find-compounds', forms: ['食肉目', '肉目', 'ことば'] },
      loadAssets,
      loadPosTags,
    );
    expect(res).toEqual({ found: { 食肉目: 'しょくにくもく', ことば: 'ことば' } });
  });

  it('find-compounds uses an all-kana candidate as its own reading', async () => {
    const res = await handleBackgroundMessage(
      db,
      { type: 'find-compounds', forms: ['コンピュータウイルス'] },
      loadAssets,
      loadPosTags,
    );
    expect(res).toEqual({ found: { コンピュータウイルス: 'コンピュータウイルス' } });
  });

  it('find-compounds with no forms returns an empty map', async () => {
    const res = await handleBackgroundMessage(
      db,
      { type: 'find-compounds', forms: [] },
      loadAssets,
      loadPosTags,
    );
    expect(res).toEqual({ found: {} });
  });

  it('lookup with parts returns part entries in the same response', async () => {
    const res = (await handleBackgroundMessage(
      db,
      {
        type: 'lookup',
        surface: '食肉目',
        basicForm: '食肉目',
        reading: 'ショクニクモク',
        parts: [
          { surface: '食肉', basicForm: '食肉', reading: 'ショクニク' },
          { surface: '目', basicForm: '目', reading: 'メ' },
        ],
      },
      loadAssets,
      loadPosTags,
    )) as LookupResult;
    expect(res.accentPos).toBe(4);
    expect(res.entries.map((e) => e.id)).toContain('2');
    expect(res.parts).toEqual([
      { word: '食肉', reading: 'しょくにく', entries: [expect.objectContaining({ id: '3' })] },
      { word: '目', reading: 'め', entries: expect.any(Array) },
    ]);
  });

  it('lookup without parts has no parts field', async () => {
    const res = (await handleBackgroundMessage(
      db,
      { type: 'lookup', basicForm: '飼う', surface: '飼っ', reading: 'カッ' },
      loadAssets,
      loadPosTags,
    )) as LookupResult;
    expect('parts' in res).toBe(false);
  });
});
