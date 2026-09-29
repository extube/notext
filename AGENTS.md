# AGENTS.md

Guidance for AI coding agents working on this repository.

## Project Overview

**notext** is a one-page, backend-free JavaScript site for language learning:
users enter or upload text, and the app parses it into structured JSON for
reading and translation practice.

- Vanilla JavaScript (ES modules), no frameworks, no build step, zero
  dependencies.
- All parsing runs client-side; `server.js` only serves static files.

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
index.html      # single page, TUI-style markup
css/style.css   # black terminal theme (scanlines, phosphor-green accents)
js/parser.js    # pure text-parsing logic (no DOM) — split into parts/sentences/words
js/app.js       # DOM/UI layer: form, upload, copy, download, status bar
server.js       # zero-dependency static file server (Node.js, ESM)
```

Keep `js/parser.js` DOM-free and pure so it stays testable from Node.

## Data Format (do not break)

Parsing output is a JSON object consumed by the learning workflow:

```json
{
  "title": "...",
  "date": "YYYY-MM-DD",
  "language": "ru|fr|en-GB|en-US|es|it|de",
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

- Design: black TUI/terminal aesthetic; do not introduce light themes,
  proportional fonts, or heavy assets.
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `chore:`).
- Branch naming: `feat/#<issue>-<slug>`, `fix/#<issue>-<slug>`.
- No secrets in the repo; no telemetry.
