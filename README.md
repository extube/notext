# notext

**notext** is a simple text translator designed for learning text.

Translate any text easily and use the results to improve your language
learning.

## Features

- Simple, minimal dark interface
- Server-rendered pages — the browser never does the parsing or rendering
- Text storage: every document is saved and gets a **preview**, **reading
  mode**, **JSON view**, and a **shareable link**
- Supported languages: Russian, French, English (UK/US), Spanish, Italian,
  German

## How It Works

1. Open the main page and **create** a document: type or paste text and choose
   the **text language** and **translation language** — or use **Upload** to
   pick a `.txt` / `.md` file.
2. The backend parses the text (blank lines → parts, sentence-ending
   punctuation → sentences, whitespace → words), stores the JSON, and opens
   the document **preview** (title, languages, first 100 words).
3. From the preview you can go to **reading mode** (each part and sentence in
   its own block with a copy button), view the raw **JSON**, or open the
   **share** page and copy a public link to the document.
4. Reading mode also offers **Begin testing** (test and results pages are
   placeholders for now).

### Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or newer recommended)
- [git](https://git-scm.com/)

### Installation

```bash
git clone git@github.com:extube/notext.git
cd notext
npm install
```

### Development

```bash
npm run dev
```

The dev server listens on port **5173** by default — open
[http://localhost:5173](http://localhost:5173).

### Production

```bash
npm run build
npm start
```

The production server listens on port **3000** by default — open
[http://localhost:3000](http://localhost:3000). Use `PORT` for a custom port
and set `ORIGIN` to stop SvelteKit's CSRF protection from rejecting form
submissions in local production runs:

```bash
PORT=4000 ORIGIN=http://localhost:4000 npm start
```

### Project Setup

- SvelteKit app (Svelte 5, `@sveltejs/adapter-node`) — every page is rendered
  server-side; the browser only receives HTML plus small interaction handlers
  (upload dialog, copy buttons).
- The parser and file storage live in `src/lib/server/`; documents are stored
  as JSON files in `data/` (created automatically, gitignored), share links in
  `data/links/`.
- styles in `src/app.css` (minimal dark theme).

## Roadmap

- [ ] Basic text translation
- [ ] Vocabulary highlighting for learning
- [ ] Saved translations for revision
- [ ] File extraction for `.epub` and `.pdf`
- [ ] SvelteKit migration with the same server-rendered routes

## Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request.

## License

MIT © [extube](https://github.com/extube)
