# Routing & Pages: notext v0.3 Spec

Reference for the `feat/#4-routing` branch. Defines the routes, page
behaviour, and storage scheme; the SvelteKit migration (notes at the end)
will keep this same route map.

## Routes (spec)

| # | Route | Purpose |
| --- | --- | --- |
| 1 | `GET /` | Main page: input form (text area or file upload `.txt`/`.md`), text language and translation language selects. Two buttons: **Create** (submit) and **Upload** (file dialog) |
| 2 | `POST /read` | Backend parses + stores the document → `303` redirect to `/doc/<id>/view` |
| 3 | `GET /doc/<id>/view` | Preview of the processed document: **title**, **languages**, **first 100 words**, and two buttons — **Share** and **Read** |
| 4 | `GET /doc/<id>/read` | Reading mode: part titles and sentences in **separate blocks**; every block has a half-opacity **Copy** button (revealed on hover) |
| 5 | `GET /doc/<id>/json` | JSON version of the text (`<pre>` view + raw link) |
| 6 | `GET /doc/<id>/share` | Share page: shows the public link and a **Copy link** button |
| 7 | `GET /link/<link_id>` | Shared-link entry: redirects (302) to `/doc/<id>/view` |
| 8 | `GET /doc/<id>/test` | Testing page (placeholder yet): **Back** and **Finish** buttons; opened via **Begin testing** on the read page |
| 9 | `GET /doc/<id>/test/result` | Test results (placeholder yet) with a **To main page** button |

Rules unchanged from v0.2: **all JavaScript logic runs on the backend** —
parsing, storage, and page rendering live in server-only modules; the browser
receives HTML plus tiny interaction scripts (upload dialog, copy buttons,
copy-link) that never render content.

## Storage Scheme

- Documents: `data/<base64_id>.json` — one file per document.
- Share links: `data/links/<base64_link_id>` — each file contains the doc id;
  `/link/<link_id>` resolves it and redirects to `/doc/<id>/view`.
- Both ids are URL-safe Base64 (base64url: `A–Z a–z 0–9 - _`, no padding) of a
  fresh UUID; validate `^[A-Za-z0-9_-]+$` before touching the filesystem
  (path-traversal guard).
- Link ids are stable: `/doc/<id>/share` reuses the existing link file for a
  document instead of generating a new one on every visit.

## Page Behaviour

### `GET /` — Main page
- Two buttons only: **Create** (submits the form) and **Upload** (opens the
  file dialog; chosen filename is shown in the status line).
- On submit the backend parses (parts ← blank lines, sentences ← `. ! ? …`,
  words ← whitespace), stores, and redirects to `/doc/<id>/view`.

### `GET /doc/<id>/view` — Preview
- Title, language meta (`language → translate_to`), first **100 words** of the
  text (with an ellipsis when truncated), plus **Read** and **Share** buttons.

### `GET /doc/<id>/read` — Reading mode
- Each part title and each sentence sits in its own bordered block.
- Every block carries a half-opacity **Copy** button (full opacity on
  hover/focus) that copies the block text; feedback swaps the label to
  "Copied" briefly.

### `GET /doc/<id>/json` — JSON version
- `<pre>` dump of the stored JSON + link to the machine endpoint
  `GET /api/docs/<id>` (raw `application/json`).

### `GET /doc/<id>/share` — Share page
- Generates (or reuses) the link id and displays the absolute
  `http://<host>/link/<link_id>` URL with a **Copy link** button.

### `GET /link/<link_id>` — Shared link
- Looks up `data/links/<link_id>`, redirects `302 → /doc/<id>/view`;
  unknown link or missing doc → 404.

## SvelteKit Mapping (future migration)

```
src/routes/
├── +layout.svelte                 # shared chrome: header, nav, footer
├── +error.svelte                  # 404 / unknown id
├── +page.svelte                   # GET /                — main form (thin view)
├── read/+server.js                # POST /read           — parse + store + redirect
├── doc/[id]/view/+page.server.js  # load doc (server-only)
├── doc/[id]/view/+page.svelte     # GET /doc/<id>/view
├── doc/[id]/read/+page.svelte     # GET /doc/<id>/read
├── doc/[id]/json/+page.svelte     # GET /doc/<id>/json
├── doc/[id]/share/+page.server.js # load/generate link id
├── doc/[id]/share/+page.svelte    # GET /doc/<id>/share
├── doc/[id]/test/+page.svelte     # GET /doc/<id>/test
├── doc/[id]/test/result/+page.svelte # GET /doc/<id>/test/result
└── link/[link_id]/+server.js      # GET /link/<link_id>  — 302 redirect
src/lib/server/                     # server-only modules
├── parser.js
└── storage.js                      # docs + links file storage
```
