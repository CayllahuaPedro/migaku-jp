import puppeteer from 'puppeteer-core';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const EXT = resolve('.output/chrome-mv3');
const CHROME = process.env.CHROME_BIN ?? '/usr/bin/chromium';

if (!existsSync(`${EXT}/manifest.json`)) {
  console.error('Falta .output/chrome-mv3 — corre npm run build primero');
  process.exit(1);
}
if (!existsSync(`${EXT}/dict/jmdict.min.json`)) {
  console.error('Faltan assets de diccionario — corre npm run build:dict y npm run build');
  process.exit(1);
}

const html = `<!doctype html><html><head><meta charset="utf-8"><title>e2e</title></head>
<body><p>猫を飼っている。学校に行きます。</p><pre>コード内の日本語は無視</pre></body></html>`;
const server = createServer((_req, res) => {
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end(html);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PAGE = `http://127.0.0.1:${server.address().port}/`;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    '--no-sandbox',
    '--disable-dev-shm-usage',
  ],
});

let failed = false;
const check = (name, ok, detail) => {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed = true;
};

try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
  await page.goto(PAGE);

  const target = await browser.waitForTarget(
    (t) => t.url().startsWith('chrome-extension://'),
    { timeout: 60000 },
  );
  const extId = new URL(target.url()).host;

  const popup = await browser.newPage();
  await popup.goto(`chrome-extension://${extId}/popup.html`);

  const imported = await popup.evaluate(
    () => chrome.runtime.sendMessage({ type: 'ensure-imported' }),
  );
  check('ensure-imported', imported?.ok === true, JSON.stringify(imported));

  await page.bringToFront();
  const parsed = await popup.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return chrome.tabs.sendMessage(tab.id, { type: 'parse-page' });
  });
  check('parse-page', parsed?.ok === true, JSON.stringify(parsed));

  const dom = await page.evaluate(() => ({
    parsed: document.querySelectorAll('.mjp-parsed').length,
    tokens: document.querySelectorAll('.mjp-token').length,
    rubies: document.querySelectorAll('.mjp-parsed ruby').length,
    colored: document.querySelectorAll('.mjp-heiban,.mjp-atamadaka,.mjp-nakadaka,.mjp-odaka').length,
    insidePre: document.querySelectorAll('pre .mjp-token').length,
  }));
  check('nodos parseados', dom.parsed > 0, `${dom.parsed}`);
  check('tokens', dom.tokens > 0, `${dom.tokens}`);
  check('furigana', dom.rubies > 0, `${dom.rubies}`);
  check('coloreado pitch', dom.colored > 0, `${dom.colored}`);
  check('pre ignorado', dom.insidePre === 0, `${dom.insidePre} tokens en <pre>`);

  const reverted = await popup.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return chrome.tabs.sendMessage(tab.id, { type: 'revert-page' });
  });
  const domAfter = await page.evaluate(
    () => document.querySelectorAll('.mjp-parsed').length,
  );
  check('revert-page', reverted?.ok === true && domAfter === 0, `${domAfter} restantes`);
} finally {
  await browser.close();
  server.close();
}

process.exit(failed ? 1 : 0);
