import { isImported, importData, lookupEntries, getAccent } from './db';
import { katakanaToHiragana } from './kana';
import type { Msg } from './messages';
import type { DictEntry, PitchMap } from './types';

type AssetLoader = () => Promise<{ entries: DictEntry[]; pitch: PitchMap }>;

export async function handleBackgroundMessage(
  db: IDBDatabase,
  msg: Msg,
  loadAssets: AssetLoader,
): Promise<unknown> {
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
      return { entries, accentPos };
    }
    default:
      return undefined;
  }
}
