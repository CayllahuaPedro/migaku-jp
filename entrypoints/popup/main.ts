import { isErrorResult } from '../../src/core/messages';

const statusEl = document.getElementById('status')!;

async function activeTabId(): Promise<number> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id == null) throw new Error('No hay pestaña activa');
  return tab.id;
}

document.getElementById('parse')!.addEventListener('click', async () => {
  try {
    statusEl.textContent = 'Preparando diccionario (solo la primera vez tarda)…';
    const importRes = await browser.runtime.sendMessage({ type: 'ensure-imported' });
    if (isErrorResult(importRes)) {
      statusEl.textContent = `Error: ${importRes.error}`;
      return;
    }
    statusEl.textContent = 'Parseando…';
    const parseRes = await browser.tabs.sendMessage(await activeTabId(), { type: 'parse-page' });
    if (isErrorResult(parseRes)) {
      statusEl.textContent = `Error: ${parseRes.error}`;
      return;
    }
    statusEl.textContent = 'Listo';
  } catch (err) {
    statusEl.textContent = `Error: ${err}`;
  }
});

document.getElementById('revert')!.addEventListener('click', async () => {
  try {
    const res = await browser.tabs.sendMessage(await activeTabId(), { type: 'revert-page' });
    if (isErrorResult(res)) {
      statusEl.textContent = `Error: ${res.error}`;
      return;
    }
    statusEl.textContent = 'Restaurado';
  } catch (err) {
    statusEl.textContent = `Error: ${err}`;
  }
});
