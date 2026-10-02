# AGENTS.md

Guidance for AI coding agents working on this repository.

## Project Overview

**notext** is a server-rendered JavaScript site for language learning: users
enter or upload text, the backend parses it into structured JSON, stores it,
and renders reading pages from it.

- SvelteKit (Svelte 5, `@sveltejs/adapter-node`, server-side rendering).
- Every page is rendered on the server (components in `src/routes/`, data
  loads in `+page.server.js`); the browser receives HTML plus small
  interaction handlers (upload dialog, copy buttons) that never render
  content.
- Parsing and storage run server-side in `src/lib/server/`; documents are
  saved to `data/<base64_id>.json` and addressed by base64url id.
- docs/routing.md records the route map and the storage scheme.

## Commands

```bash
npm run dev         # dev server (vite dev, default port 5173)
npm run build       # production build into build/
npm start           # run the production build (PORT env, default 3000)
PORT=4000 npm start # run the production build on a custom port
```

The adapter-node server expects `ORIGIN=http://localhost:<port>` in local
production runs (SvelteKit CSRF protection rejects form posts otherwise); use
`PROTOCOL_HEADER`/`HOST_HEADER` behind a reverse proxy.

There is no test framework or linter yet. To verify changes:

- Parser logic: `node -e "import('./src/lib/server/parser.js').then(m => console.log(m.parseText('Hi there! Ok?', {title:'t', date:'2026-01-01', language:'en-US'})))"`
- Site: `npm run build` then start the server and check
  `http://localhost:<port>/` returns 200.

## Project Structure

```
src/routes/         # file-based routes (all server-rendered):
  +page.svelte      # GET / — form with Create / Upload buttons
  doc/[id]/view|read|json|share|test[...]  # doc pages, +page.server.js loads
  link/[link_id]/+server.js  # shared link → 302 to /doc/<id>/view
  api/docs/[id]/+server.js   # raw JSON (application/json)
src/lib/
  server/parser.js  # pure text-parsing logic (no DOM) — testable from Node
  server/storage.js # file storage: docs, share links (Node fs)
  languages.js      # shared 7-language list
svelte.config.js    # @sveltejs/adapter-node
src/app.css         # minimal dark theme (near-black surfaces, one green accent)
data/               # file storage: data/<base64_id>.json per document, data/links/<link_id> → doc id (gitignored)
```

Keep `src/lib/server/parser.js` DOM-free and pure so it stays testable from
Node.

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
