# Routing & Pages: notext v0.2 Spec

Reference for the `feat/#2-svelte-migration` branch. Defines the target
routes, page behaviour, storage scheme, and the routing best practices behind
the decisions.

## Target Routes (spec)

| # | Route | Purpose |
| --- | --- | --- |
| 1 | `GET /` | Main page: form to type text or load a file (`.txt`, `.epub`, `.pdf`), select **text language** and **translation language**, parse → store → redirect |

**Rule: all JavaScript logic runs on the backend.** Text extraction, parsing,
and storage live in server-only modules; Svelte components are thin views
that only render server-provided data and forward form submissions.
| 2 | `GET /json/<base64_id>` | Raw JSON of a stored document |
| 3 | `GET /doc/<base64_id>` | Rendered document: reading view (see below) |

Implied companion endpoint (creation is not a GET):

| Route | Purpose |
| --- | --- |
| `POST /api/docs` | Accept parsed JSON, save to file storage, return `{ "id": "<base64_id>" }` |

## Storage Scheme

- Documents live in **file storage**: one file per document, e.g.
  `data/<id>.json`.
- `id` = URL-safe Base64 (**base64url**: `A–Z a–z 0–9 - _`, no padding) of a
  fresh UUID → no `/` or `+` in URLs, safe as a path segment and filename.
- Pages read documents through server-only load functions
  (`+page.server.js`) that hit the storage dir directly; nothing
  document-related is fetched from the browser.

## Page Behaviour

### `GET /` — Input page

- Textarea to type/paste text.
- File upload accepting **`.txt`**, **`.epub`**, **`.pdf`**. The raw file is
  POSTed unchanged; **extraction runs on the backend**: `.txt` read as UTF-8,
  `.epub` unzipped → spine XHTML → tag stripping (JSZip), `.pdf` text-layer
  extraction (pdfjs-dist legacy build). All formats feed the same
  `parseText()` pipeline, executed server-side.
- Two language selects (same 7-language list):
  - **text language** → `language` meta field;
  - **translation language** → new `translate_to` meta field (additive change
    to the JSON contract).
- On submit: `POST /api/docs` with the raw file or pasted text + metadata →
  backend extracts, parses, stores → responds `{ "id": "<base64_id>" }` →
  client redirects to `/doc/<id>` (with a link to `/json/<id>`).

### `GET /json/<base64_id>` — Raw JSON page

- Minimal page rendering the stored document as plain `<pre>` JSON (raw, no
  highlighting chrome) + copy/download buttons + link to `/doc/<id>`.
- Unknown id → 404 via `+error.svelte`.

### `GET /doc/<base64_id>` — Rendered document page

- Reading window styled with the existing TUI theme.
- Each **part** renders its part number as a heading paragraph; each
  **sentence** is its own paragraph (`<p>`).
- **Sentence copy**: hover/focus a sentence → copy affordance (button or
  click-to-copy); copies the sentence text, not the markup.
- **Word selection**: every word is wrapped in a selectable element (`<span>`);
  selected/hovered words are **underlined** (accent colour), preparing the
  hook for future per-word translation popovers.

## SvelteKit Mapping

```
src/routes/
├── +layout.svelte            # shared chrome: header, nav, status bar
├── +error.svelte             # 404 / unknown id
├── +page.svelte              # GET /            — input page (thin view only)
├── api/docs/+server.js       # POST /api/docs   — extract + parse + store (server-only)
├── json/[id]/+page.server.js # load raw doc for /json/<base64_id> (server-only)
├── json/[id]/+page.svelte    # GET /json/<base64_id>
├── doc/[id]/+page.server.js  # load doc for /doc/<base64_id> (server-only)
└── doc/[id]/+page.svelte     # GET /doc/<base64_id>
src/lib/server/               # SERVER-ONLY modules (never imported by components)
├── parser.js                 # moved as-is (pure, DOM-free)
├── storage.js                # file-storage read/write (Node fs)
└── extract/                  # txt / epub (JSZip) / pdf (pdfjs-dist) extraction
```

- `[id]` dynamic segment maps to `base64_id`; validate `^[A-Za-z0-9_-]+$`
  before touching the filesystem (path-traversal guard).
- Adapter: **`@sveltejs/adapter-node`** — dynamic ids + server-side file
  storage require a Node runtime; static prerendering no longer fits.

## Routing Best Practices (why this shape)

1. **All JS logic runs on the backend** — extraction, parsing, and storage in
   `src/lib/server/`; components never import from there (SvelteKit enforces
   the `$lib/server` boundary). Pages are thin views over server-loaded data.
2. **File-based routing** (SvelteKit): the filesystem is the route map — no
   central config, automatic code-splitting per page, `+layout.svelte` for
   shared chrome, `+error.svelte` for 404s.
3. **`+page.svelte` is the best-practice file type** for pages; `+server.js`
   only for non-HTML endpoints (`POST /api/docs`); `+page.server.js` for
   server-only data loading.
4. **One page = one folder.** Deleting a folder deletes the page.
5. Real paths over hash URLs; navigation via `<a href>` / `goto()`, never raw
   `history.pushState`.
6. Shared client state stays minimal (form state only) — documents live in
   storage and are addressed by id, not held in stores.
7. Keep `parser.js` pure and DOM-free — still testable from Node
   (`AGENTS.md` contract); it now runs inside `src/lib/server/`.
8. Validate/normalise all URL params server-side; never trust `id` as a path.

## Cost of the Migration (updated)

- Dependencies: `svelte`, `@sveltejs/kit`, `vite`, `@sveltejs/adapter-node`;
  backend extraction: `jszip` (epub), `pdfjs-dist` legacy build (pdf) — both
  run server-side only.
- The site gains a **thin Node backend** that does all the work (extraction,
  parsing, storage, rendering); the browser only receives HTML and sends
  form submissions. The old zero-dependency `server.js` is replaced by the
  SvelteKit Node server.
- `AGENTS.md` commands, structure, and data-format sections must be updated
  when this lands (add `translate_to`, file storage, new routes,
  backend-only rule).
