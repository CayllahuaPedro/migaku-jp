import { isImported, importData, lookupEntries, getAccent } from './db';
import { katakanaToHiragana } from './kana';
import type { AnnotateResult, ErrorResult, LookupResult, Msg } from './messages';
import type { DictEntry, PitchMap, PosTagMap } from './types';

type AssetLoader = () => Promise<{ entries: DictEntry[]; pitch: PitchMap }>;
type PosTagLoader = () => Promise<PosTagMap>;

export async function handleBackgroundMessage(
  db: IDBDatabase,
  msg: Msg,
  loadAssets: AssetLoader,
  loadPosTags: PosTagLoader,
):Promise<{ ok: true } | AnnotateResult | LookupResult | ErrorResult | undefined> {
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
    case 'lookup': {
      let entries = await lookupEntries(db, msg.basicForm);
      if (entries.length === 0 && msg.surface !== msg.basicForm) {
        entries = await lookupEntries(db, msg.surface);
      }
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
      return { entries, accentPos, posTags };
    }
    default:
      return undefined;
  }
}
