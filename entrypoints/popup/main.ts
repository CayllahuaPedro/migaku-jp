import { isErrorResult } from '../../src/core/messages';
import { NATIVE_LANGS, getSettings, saveSettings } from '../../src/core/settings';
import { FONTS_CSS_PATH } from '../../src/ui/theme';
import { linkFontStylesheet } from '../../src/ui/fonts';
import { POPUP_PAGE_CSS } from './styles';

type StatusState = 'busy' | 'ok' | 'error';

const TAB_UNREACHABLE =
  'No se puede anotar esta pestaña. Si la abriste antes de instalar la extensión, recárgala.';

linkFontStylesheet(browser.runtime.getURL(FONTS_CSS_PATH));
const style = document.createElement('style');
style.textContent = POPUP_PAGE_CSS;
document.head.append(style);

const statusEl = document.getElementById('status')!;
const statusTextEl = document.getElementById('status-text')!;

function setStatus(state: StatusState, text: string): void {
  statusEl.dataset.state = state;
  statusTextEl.textContent = text;
}

function fail(text: string, detail: unknown): void {
  console.error('[yabai-jp]', detail);
  setStatus('error', text);
}

async function sendToActiveTab(type: 'parse-page' | 'revert-page'): Promise<unknown> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id == null) throw new Error('No active tab');
  return browser.tabs.sendMessage(tab.id, { type });
}

document.getElementById('parse')!.addEventListener('click', async () => {
  setStatus('busy', 'Cargando el diccionario. La primera vez tarda más.');
  const importRes = await browser.runtime.sendMessage({ type: 'ensure-imported' }).catch((err) => ({
    error: String(err),
  }));
  if (isErrorResult(importRes)) {
    fail('No se pudo cargar el diccionario. Inténtalo de nuevo.', importRes.error);
    return;
  }
  setStatus('busy', 'Anotando la página…');
  try {
    const res = await sendToActiveTab('parse-page');
    if (isErrorResult(res)) {
      fail('No se pudo anotar la página. Inténtalo de nuevo.', res.error);
      return;
    }
    setStatus('ok', 'Página anotada');
  } catch (err) {
    fail(TAB_UNREACHABLE, err);
  }
});

document.getElementById('revert')!.addEventListener('click', async () => {
  try {
    const res = await sendToActiveTab('revert-page');
    if (isErrorResult(res)) {
      fail('No se pudieron quitar las anotaciones. Inténtalo de nuevo.', res.error);
      return;
    }
    setStatus('ok', 'Anotaciones quitadas');
  } catch (err) {
    fail(TAB_UNREACHABLE, err);
  }
});

const dualSubsInput = document.getElementById('yt-dual') as HTMLInputElement;
const pauseInput = document.getElementById('yt-pause') as HTMLInputElement;
const nativeLangSelect = document.getElementById('native-lang') as HTMLSelectElement;

nativeLangSelect.replaceChildren(
  ...NATIVE_LANGS.map(({ code, label }) => new Option(label, code)),
);

getSettings().then((settings) => {
  dualSubsInput.checked = settings.youtubeDualSubs;
  pauseInput.checked = settings.pauseOnLookup;
  nativeLangSelect.value = settings.nativeLang;
});

dualSubsInput.addEventListener('change', () =>
  saveSettings({ youtubeDualSubs: dualSubsInput.checked }),
);
pauseInput.addEventListener('change', () =>
  saveSettings({ pauseOnLookup: pauseInput.checked }),
);
nativeLangSelect.addEventListener('change', () =>
  saveSettings({ nativeLang: nativeLangSelect.value }),
);
