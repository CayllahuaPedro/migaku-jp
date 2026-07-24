# Yabai-JP

A Chrome extension that annotates Japanese text on any web page with **furigana** and
**pitch-accent colouring**, and shows dictionary definitions on click.

Everything runs locally. No backend, no account, no network requests — the dictionary
(~44 MB of JMdict + Kanjium pitch data) is imported into IndexedDB on first run and never
leaves the browser.

<!-- TODO: demo.gif — before/after of clicking "Parse page" on a Japanese article -->

## Why

Commercial tools charge a monthly subscription for pitch-accent colouring, and the free
alternatives (Yomitan, 10ten) only show accent data inside a hover popup — never inline on
the text you are actually reading. This does it inline, on the page, offline.

## Pitch-accent colouring

Each word is coloured by its accent pattern, derived from the accent position `N` and the
mora count `M` of its reading:

| Pattern   | Rule          | Colour              |
|-----------|---------------|---------------------|
| Heiban    | `N = 0`       | blue `#2e7dd1`      |
| Atamadaka | `N = 1`       | red `#d13b3b`       |
| Nakadaka  | `1 < N < M`   | orange `#e08a00`    |
| Odaka     | `N = M`       | green `#2fa356`     |
| Unknown   | no data       | inherits page colour |

Mora segmentation collapses youon (きゃ, しゅ, …) into a single mora, which is what makes
`M` — and therefore the pattern — correct.

## Architecture

A pure-TypeScript language engine with no DOM dependencies, plus thin surfaces that plug it
into each context. The engine is where the value is, and it is testable in isolation.

```
SURFACES (content scripts)
  web text  ·  YouTube subs (planned)  ·  Netflix subs (planned)
       │
LANGUAGE ENGINE (pure TS)
  tokenize → lookup → pitch → mora → furigana → render
       │
DATA (IndexedDB, imported once)
  kuromoji IPADIC  ·  JMdict EN  ·  Kanjium pitch
```

| Path | Role |
|------|------|
| [src/core/](src/core/) | Tokenizer, dictionary lookup, pitch classification, mora segmentation, furigana, rendering |
| [src/surfaces/](src/surfaces/) | Web-text surface: walks visible text nodes, annotates, reverts |
| [src/ui/DictPopup/](src/ui/DictPopup/) | Definition popup, rendered in Shadow DOM so page CSS cannot reach it |
| [entrypoints/](entrypoints/) | MV3 background service worker, content script, extension popup |

**One runtime dependency** (`kuromoji`). Everything else is dev-only.

## Engineering notes

Three things that were not obvious and cost real time:

**kuromoji needs a `path` shim in the browser bundle.** kuromoji calls `require('path')` to
locate its dictionary files. Vite externalises that to an empty stub for browser targets, so
tokenizing died with `path.join is not a function`. Fixed by aliasing `path` to a minimal
[shim](src/shims/path.ts) implementing only `join` — covered by [its own test](tests/pathShim.test.ts).

**`wxt` is pinned to exactly `0.20.18`.** From `0.20.19` it pulls Vite 8 internally, which
breaks WxtVitest — Vitest 2 requires Vite 5. Revisit when moving to wxt 1.x.

**Annotation is reverted, not re-rendered.** Each injected token carries its source text in a
`data-mjp-*` attribute, so restoring the page is an exact inverse rather than a reload.

## Setup

```bash
npm install
```

The dictionary data is not committed. Place the raw sources in `data/raw/`:

- `jmdict-eng.json` — from [jmdict-simplified](https://github.com/scriptin/jmdict-simplified)
- `accents.txt` — Kanjium pitch-accent dataset

Then build the packaged assets and the extension:

```bash
npm run build:dict   # → public/dict/{jmdict.min.json,pitch.json}
npm run build        # → .output/
```

Load `.output/chrome-mv3` as an unpacked extension at `chrome://extensions`.
Open the extension popup on a Japanese page and hit **Parse page**; **Restore** puts it back.

## Tests

```bash
npm test    # 45 unit tests across 14 files — vitest, fake-indexeddb, happy-dom
npm run e2e # smoke test in a real Chrome instance with the extension loaded
```

The E2E harness drives an actual browser via `puppeteer-core` rather than mocking the
extension APIs, because the failures worth catching here (service-worker lifecycle, bundle
resolution, `web_accessible_resources`) only appear in a real MV3 runtime.

## Status

Phase 1 — web text — is complete and in daily use.

Planned:

- Compound merging after tokenization. IPADIC splits 食肉目 into 食肉 + 目 even though JMdict
  holds the full entry; adjacent tokens should be merged when their concatenation exists in
  the dictionary.
- Batched annotation — currently one message per text node, which is slow on large pages.
- Service-worker keepalive and progress reporting during the initial 44 MB import.
- Dual subtitles on YouTube (phase 2) and Netflix (phase 3).
- Anki export.

## Licence

Personal project, unlicensed for redistribution. JMdict and Kanjium carry their own licences.
