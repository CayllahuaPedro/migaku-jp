import { openDb } from '../src/core/db';
import { handleBackgroundMessage } from '../src/core/backgroundHandlers';
import type { Msg } from '../src/core/messages';
import type { DictEntry, PitchMap } from '../src/core/types';

export default defineBackground(() => {
  let dbPromise: Promise<IDBDatabase> | null = null;
  const getDb = () => (dbPromise ??= openDb());

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

  browser.runtime.onMessage.addListener((msg: Msg, _sender, sendResponse) => {
    getDb()
      .then((db) => handleBackgroundMessage(db, msg, loadAssets))
      .then(sendResponse)
      .catch((err) => {
        console.error('[migaku-jp] background error', err);
        sendResponse({ error: String(err) });
      });
    return true;
  });
});
