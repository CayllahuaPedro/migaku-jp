import { initTokenizer } from '../src/core/tokenizer';
import {
  findJapaneseTextNodes,
  parseTextNode,
  revertPage,
  injectStyles,
} from '../src/surfaces/webText';
import { DictPopup } from '../src/ui/DictPopup';
import type { Msg, AnnotateResult, LookupResult, TokenQuery } from '../src/core/messages';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    let popup: DictPopup | null = null;
    const getPopup = () => (popup ??= new DictPopup());

    const annotate = (tokens: TokenQuery[]) =>
      browser.runtime.sendMessage({ type: 'annotate', tokens }) as Promise<AnnotateResult>;

    async function parsePage() {
      injectStyles();
      await initTokenizer(browser.runtime.getURL('/kuromoji/'));
      for (const node of findJapaneseTextNodes(document.body)) {
        try {
          await parseTextNode(node, annotate);
        } catch (err) {
          console.warn('[migaku-jp] nodo falló, se omite', err);
        }
      }
    }

    document.addEventListener('click', async (ev) => {
      const el = (ev.target as Element).closest?.('.mjp-token') as HTMLElement | null;
      if (!el) {
        popup?.hide();
        return;
      }
      ev.preventDefault();
      ev.stopPropagation();
      const {
        mjpSurface: surface = '',
        mjpBasicForm: basicForm = surface,
        mjpReading: reading,
      } = el.dataset;
      try {
        const res = (await browser.runtime.sendMessage({
          type: 'lookup',
          basicForm,
          surface,
          reading,
        })) as LookupResult;
        getPopup().show(el.getBoundingClientRect(), {
          word: basicForm,
          reading,
          accentPos: res.accentPos,
          entries: res.entries ?? [],
        });
      } catch (err) {
        console.warn('[migaku-jp] lookup falló', err);
      }
    });

    browser.runtime.onMessage.addListener((msg: Msg, _sender, sendResponse) => {
      if (msg.type === 'parse-page') {
        parsePage()
          .then(() => sendResponse({ ok: true }))
          .catch((err) => sendResponse({ error: String(err) }));
        return true;
      }
      if (msg.type === 'revert-page') {
        revertPage(document.body);
        popup?.hide();
        sendResponse({ ok: true });
      }
    });
  },
});
