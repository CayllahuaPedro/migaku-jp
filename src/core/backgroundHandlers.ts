import { isImported, importData, lookupEntries, getAccent } from './db';
import { katakanaToHiragana } from './kana';
import type {
  AnnotateResult,
  ErrorResult,
  FindCompoundsResult,
  LookupResult,
  Msg,
  TokenQuery,
} from './messages';
import type { DictEntry, PitchMap, PosTagMap } from './types';

type AssetLoader = () => Promise<{ entries: DictEntry[]; pitch: PitchMap }>;
type PosTagLoader = () => Promise<PosTagMap>;

async function lookupByBasicFormOrSurface(db: IDBDatabase, query: TokenQuery) {
  const entries = await lookupEntries(db, query.basicForm);
  if (entries.length === 0 && query.surface !== query.basicForm) {
    return lookupEntries(db, query.surface);
  }
  return entries;
}

export async function handleBackgroundMessage(
  db: IDBDatabase,
  msg: Msg,
  loadAssets: AssetLoader,
  loadPosTags: PosTagLoader,
):Promise<{ ok: true } | AnnotateResult | FindCompoundsResult | LookupResult | ErrorResult | undefined> {
  switch (msg.type) {
    case 'ensure-imported': {
      if (!(await isImported(db))) {
        const { entries, pitch } = await loadAssets();
        await importData(db, entries, pitch);
      }
      return { ok: true };
    }
    case 'annotate': {
      const accents = await Promise.all(
        msg.tokens.map((t) =>
          getAccent(
            db,
            t.basicForm,
            t.reading ? katakanaToHiragana(t.reading) : undefined,
          ),
        ),
      );
      return { accents };
    }
    case 'find-compounds': {
      const matches = await Promise.all(
        msg.forms.map(async (form) => [form, (await lookupEntries(db, form))[0]] as const),
      );
      const found: Record<string, string> = {};
      for (const [form, entry] of matches) {
        if (entry) found[form] = entry.kana[0] ?? form;
      }
      return { found };
    }
    case 'lookup': {
      const entries = await lookupByBasicFormOrSurface(db, msg);
      const accentPos = await getAccent(
        db,
        msg.basicForm,
        msg.reading ? katakanaToHiragana(msg.reading) : undefined,
      );
      const allPosTags = await loadPosTags();
      const posTags = Object.fromEntries(
        entries
          .flatMap((e) => e.senses.flatMap((s) => s.pos))
          .filter((code) => code in allPosTags)
          .map((code) => [code, allPosTags[code]]),
      );
      if (!msg.parts) return { entries, accentPos, posTags };
      const parts = await Promise.all(
        msg.parts.map(async (part) => ({
          word: part.basicForm,
          reading: part.reading ? katakanaToHiragana(part.reading) : undefined,
          entries: await lookupByBasicFormOrSurface(db, part),
        })),
      );
      return { entries, accentPos, posTags, parts };
    }
    default:
      return undefined;
  }
}
