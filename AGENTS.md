# AGENTS.md

Guidance for AI coding agents working on this repository.

## Project Overview

**notext** is a server-rendered JavaScript site for language learning: users
enter or upload text, the backend parses it into structured JSON, stores it,
and renders reading pages from it.

- Vanilla JavaScript (ES modules), no frameworks, no build step, zero
  dependencies.
- All pages are rendered server-side by `server.js` (HTML templates in
  `js/pages.js`); the browser receives HTML plus tiny interaction scripts
  (upload dialog, copy/select) that never render content.
- Parsing and storage run server-side; documents are saved to
  `data/<base64_id>.json` and addressed by base64url id.
- The SvelteKit migration (docs/routing.md) will replace this stack while
  keeping the same routes and server-side rendering.

## Commands

```bash
npm start          # start static server (default port 3000)
PORT=4000 npm start  # start on a custom port
```

There is no test framework or linter yet. To verify changes:

- Parser logic: `node -e "import('./js/parser.js').then(m => console.log(m.parseText('Hi there! Ok?', {title:'t', date:'2026-01-01', language:'en-US'})))"`
- Site: start the server and check `http://localhost:<port>/` returns 200.

## Project Structure

```
server.js       # zero-dependency server: renders all pages, POST /read, storage, /json/<id>
js/pages.js     # server-side HTML templates for every page (form, doc, json, 404)
js/parser.js    # pure text-parsing logic (no DOM) — used server-side, testable from Node
js/form.js      # main page helper: upload dialog only (no rendering)
js/doc.js       # doc page helper: copy sentence / select word only (no rendering)
css/style.css   # minimal dark theme (near-black surfaces, one green accent)
data/           # file storage: one <base64_id>.json per document (gitignored)
```

Keep `js/parser.js` DOM-free and pure so it stays testable from Node.

## Data Format (do not break)

Parsing output is a JSON object consumed by the learning workflow:

```json
{
  "title": "...",
  "date": "YYYY-MM-DD",
  "language": "ru|fr|en-GB|en-US|es|it|de",
  "translate_to": "ru|fr|en-GB|en-US|es|it|de",
  "part_1": {
    "sentences": [{ "words": ["..."] }]
  }
}
```

- Blank lines separate parts (`part_1`, `part_2`, …).
- Sentences are split on `.`, `!`, `?`, `…`.
- Words are whitespace-separated; punctuation stays attached.
- Supported languages: Russian, French, English (UK), English (US), Spanish,
  Italian, German.

## Conventions

- Design: minimal dark UI — no light themes, no terminal/CRT effects (no
  scanlines, ASCII art, monospace-for-UI), no heavy assets; forms stay small
  and focused.
- The main page never embeds the JSON output; parsed results surface as a
  status line plus copy/download actions.
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `chore:`).
- Branch naming: `feat/#<issue>-<slug>`, `fix/#<issue>-<slug>`.
- No secrets in the repo; no telemetry.
