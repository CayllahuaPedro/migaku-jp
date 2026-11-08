import { parseParts } from '../src/core/compounds';
import { analyzeText } from '../src/core/analyze';
import { initTokenizer, tokenize } from '../src/core/tokenizer';
import {
  findJapaneseTextNodes,
  parseTextNode,
  revertPage,
  injectStyles,
} from '../src/surfaces/webText';
import { DictPopup } from '../src/ui/DictPopup';
import { FONTS_CSS_PATH } from '../src/ui/theme';
import {
  isErrorResult,
  type Msg,
  type AnnotateResult,
  type ErrorResult,
  type FindCompoundsResult,
  type LookupResult,
  type TokenQuery,
} from '../src/core/messages';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    let popup: DictPopup | null = null;
    const getPopup = () => (popup ??= new DictPopup());

    const annotate = async (tokens: TokenQuery[]): Promise<AnnotateResult> => {
      const res = (await browser.runtime.sendMessage({ type: 'annotate', tokens })) as
        | AnnotateResult
        | ErrorResult;
      if (isErrorResult(res)) throw new Error(res.error);
      return res;
    };

    const findCompounds = async (forms: string[]) => {
      const res = (await browser.runtime.sendMessage({ type: 'find-compounds', forms })) as
        | FindCompoundsResult
        | ErrorResult;
      if (isErrorResult(res)) throw new Error(res.error);
      return res.found;
    };

    const analyze = (text: string) =>
      analyzeText(text, { tokenize, findCompounds, annotate });

    async function parsePage() {
      injectStyles(browser.runtime.getURL(FONTS_CSS_PATH));
      await initTokenizer(browser.runtime.getURL('/kuromoji/'));
      for (const node of findJapaneseTextNodes(document.body)) {
        try {
          await parseTextNode(node, analyze);
        } catch (err) {
          console.warn('[yabai-jp] nodo falló, se omite', err);
        }
      }
    }

    document.addEventListener('click', async (ev) => {
      if ((ev.target as Element).closest?.('.mjp-popup-host')) return;
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
      const parts = parseParts(el.dataset.mjpParts);
      try {
        const res = (await browser.runtime.sendMessage({
          type: 'lookup',
          basicForm,
          surface,
          reading,
          parts,
        })) as LookupResult | ErrorResult;
        if (isErrorResult(res)) {
          console.warn('[yabai-jp] lookup falló', res.error);
          return;
        }
        getPopup().show(el.getBoundingClientRect(), {
          word: basicForm,
          reading,
          accentPos: res.accentPos,
          entries: res.entries ?? [],
          posTags: res.posTags,
          parts: res.parts,
        });
      } catch (err) {
        console.warn('[yabai-jp] lookup falló', err);
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
