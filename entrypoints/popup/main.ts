const statusEl = document.getElementById('status')!;

async function activeTabId(): Promise<number> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id == null) throw new Error('No hay pestaña activa');
  return tab.id;
}

document.getElementById('parse')!.addEventListener('click', async () => {
  try {
    statusEl.textContent = 'Preparando diccionario (solo la primera vez tarda)…';
    await browser.runtime.sendMessage({ type: 'ensure-imported' });
    statusEl.textContent = 'Parseando…';
    await browser.tabs.sendMessage(await activeTabId(), { type: 'parse-page' });
    statusEl.textContent = 'Listo';
  } catch (err) {
    statusEl.textContent = `Error: ${err}`;
  }
});

document.getElementById('revert')!.addEventListener('click', async () => {
  try {
    await browser.tabs.sendMessage(await activeTabId(), { type: 'revert-page' });
    statusEl.textContent = 'Restaurado';
  } catch (err) {
    statusEl.textContent = `Error: ${err}`;
  }
});
