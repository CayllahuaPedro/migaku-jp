# Yabai-JP

A Chrome extension for learning Japanese from real content:

- **Web pages** — annotates Japanese text with **furigana** and **pitch-accent colouring**,
  and shows dictionary definitions on click.
- **YouTube** — **dual subtitles**: Japanese on top, your language underneath, always on,
  no switching tracks.

Everything runs locally. No backend, no account — the dictionary (~44 MB of JMdict + Kanjium
pitch data) is imported into IndexedDB on first run and never leaves the browser. The only
network traffic is YouTube's own subtitle endpoint.

<!-- TODO: demo.gif — before/after of clicking "Anotar página" on a Japanese article -->
<!-- TODO: dual-subs.gif — a YouTube video playing with Japanese + English lines -->

## Why

Commercial tools charge a monthly subscription for pitch-accent colouring, and the free
alternatives (Yomitan, 10ten) only show accent data inside a hover popup — never inline on
the text you are actually reading. This does it inline, on the page, offline.

## Pitch-accent colouring

Each word is coloured by its accent pattern, derived from the accent position `N` and the
mora count `M` of its reading:

| Pattern   | Rule          | Colour              |
|-----------|---------------|---------------------|
| Heiban    | `N = 0`       | blue `#2b77c9`      |
| Atamadaka | `N = 1`       | red `#d13b3b`       |
| Nakadaka  | `1 < N < M`   | orange `#a86400`    |
| Odaka     | `N = M`       | green `#23804a`     |
| Unknown   | no data       | inherits page colour |

All four colours meet WCAG AA (4.5:1) against a white page.

Mora segmentation collapses youon (きゃ, しゅ, …) into a single mora, which is what makes
`M` — and therefore the pattern — correct.

## Dual subtitles on YouTube

Open any `youtube.com/watch` video that has Japanese captions and two lines appear over the
player, synced to the video:

| Line | Source, in order of preference |
|------|--------------------------------|
| Japanese | Human-made track → YouTube auto-captions (ASR) |
| Translation | Human-made track in your language → YouTube auto-translate from the Japanese track |

- Translation language is set in the extension popup (default **English**), and the toggle
  turns the feature off. Changes apply to the open video without reloading.
- Native captions are hidden while the overlay is up and come back otherwise.
- Videos without Japanese, live streams, Shorts and embeds are left untouched.
- The overlay scales with the player (theater, fullscreen), moves up when the controls show,
  and hides during ads.
- Words on the Japanese line are pitch-coloured and clickable: a click opens the dictionary
  popup. An optional setting pauses the video while the popup is open.

## Architecture

A pure-TypeScript language engine with no DOM dependencies, plus thin surfaces that plug it
into each context. The engine is where the value is, and it is testable in isolation.

```
SURFACES (content scripts)
  web text  ·  YouTube dual subs  ·  Netflix subs (planned)
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
| [src/surfaces/youtube/](src/surfaces/youtube/) | Track selection, json3 parsing, the cross-world bridge, and the session state machine (navigation, retries, settings) |
| [src/ui/DictPopup/](src/ui/DictPopup/) | Definition popup, rendered in Shadow DOM so page CSS cannot reach it |
| [src/ui/SubtitleOverlay/](src/ui/SubtitleOverlay/) | Dual-line overlay in Shadow DOM, synced to `video.currentTime` (reusable for Netflix) |
| [entrypoints/](entrypoints/) | MV3 background service worker, content scripts (web text, YouTube MAIN + isolated), extension popup |

**One runtime dependency** (`kuromoji`). Everything else is dev-only.

## Engineering notes

Things that were not obvious and cost real time:

**kuromoji needs a `path` shim in the browser bundle.** kuromoji calls `require('path')` to
locate its dictionary files. Vite externalises that to an empty stub for browser targets, so
tokenizing died with `path.join is not a function`. Fixed by aliasing `path` to a minimal
[shim](src/shims/path.ts) implementing only `join` — covered by [its own test](tests/pathShim.test.ts).

**`wxt` is pinned to exactly `0.20.18`.** From `0.20.19` it pulls Vite 8 internally, which
breaks WxtVitest — Vitest 2 requires Vite 5. Revisit when moving to wxt 1.x.

**Annotation is reverted, not re-rendered.** Each injected token carries its source text in a
`data-mjp-*` attribute, so restoring the page is an exact inverse rather than a reload.

**YouTube subtitles need the player's own request.** The `timedtext` endpoint can answer
`200` with an empty body unless the request carries the player's Proof-of-Origin token, and
the player's first request often goes out before that token exists. So a MAIN-world script
hooks `fetch`/XHR at `document_start`, captures the player's (relative) request URL as a
template, and re-asks the player for captions when the first Japanese track comes back empty.
The isolated content script talks to it over a namespaced `postMessage` bridge.

**IPADIC splits compounds, so the engine merges them back.** IPADIC tokenizes 食肉目 as
食肉 + 目 and reads each part in isolation, giving しょくにくめ instead of しょくにくもく. After
tokenization, adjacent nouns, prefixes and suffixes are tried against the JMdict forms index,
longest match first, up to 4 tokens. The merged token takes its reading from JMdict, and the
popup shows the compound on top with its parts under **Partes**.

**Forcing captions on leaks into every tab.** Switching the player to Japanese writes
`yt-player-caption-*` keys to `localStorage`, which all YouTube tabs share — other videos
started auto-translating to Japanese. The MAIN-world agent snapshots those keys before
forcing captions and writes them back right after, on restore and on `pagehide`, so the
user's caption preference is never left changed.

**Headless Chrome gets empty captions.** YouTube serves empty subtitle bodies to headless
browsers — even to its own player — so live verification stubbed only `/api/timedtext` and
kept the real player, navigation and caption state.

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

- **Web text:** open the extension popup on a Japanese page and hit **Anotar página**
  (annotate page); **Quitar anotaciones** (remove annotations) puts it back.
- **YouTube:** open a video with Japanese captions — the dual subtitles start on their own.
  Pick the translation language under **Idioma de traducción** in the popup.

## Tests

```bash
npm test    # 236 unit tests across 27 files — vitest, fake-indexeddb, happy-dom
npm run e2e # smoke test in a real Chrome instance with the extension loaded
```

The E2E harness drives an actual browser via `puppeteer-core` rather than mocking the
extension APIs, because the failures worth catching here (service-worker lifecycle, bundle
resolution, `web_accessible_resources`) only appear in a real MV3 runtime.

## Status

- Phase 1 — web text — complete and in daily use.
- Phase 2 — flat dual subtitles on YouTube — complete.

Planned:

- Batched annotation — currently one message per text node, which is slow on large pages.
- Service-worker keepalive and progress reporting during the initial 44 MB import.
- Furigana in the subtitles and word frequency in the popup.
- Dual subtitles on Netflix (phase 3), reusing the same overlay.
- Anki export.

## Licence

Personal project, unlicensed for redistribution. JMdict and Kanjium carry their own licences.
