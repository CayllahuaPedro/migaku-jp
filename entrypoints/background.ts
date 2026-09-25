import { openDb } from '../src/core/db';
import { handleBackgroundMessage } from '../src/core/backgroundHandlers';
import type { Msg } from '../src/core/messages';
import type { DictEntry, PitchMap, PosTagMap } from '../src/core/types';

export default defineBackground(() => {
  let dbPromise: Promise<IDBDatabase> | null = null;
  const getDb = () =>
    (dbPromise ??= openDb().catch((err) => {
      dbPromise = null;
      throw err;
    }));

  const loadAssets = async () => {
    const [entriesRes, pitchRes] = await Promise.all([
      fetch(browser.runtime.getURL('/dict/jmdict.min.json')),
      fetch(browser.runtime.getURL('/dict/pitch.json')),
    ]);
    return {
      entries: (await entriesRes.json()) as DictEntry[],
      pitch: (await pitchRes.json()) as PitchMap,
    };
  };

  let posTagsPromise: Promise<PosTagMap> | null = null;
  const loadPosTags = () =>
    (posTagsPromise ??= fetch(browser.runtime.getURL('/dict/pos-tags.json'))
      .then((res) => res.json() as Promise<PosTagMap>)
      .catch((err) => {
        console.warn('[yabai-jp] pos-tags.json no disponible; sigue sin descripciones', err);
        return {};
      }));

  browser.runtime.onMessage.addListener((msg: Msg, _sender, sendResponse) => {
    getDb()
      .then((db) => handleBackgroundMessage(db, msg, loadAssets, loadPosTags))
      .then(sendResponse)
      .catch((err) => {
        console.error('[yabai-jp] background error', err);
        sendResponse({ error: String(err) });
      });
    return true;
  });
});
