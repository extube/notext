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

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or newer recommended)
- [git](https://git-scm.com/)

### Installation

```bash
git clone git@github.com:extube/notext.git
cd notext
npm install
```

### Usage

```bash
npm start
```

The server listens on port **3000** by default — open
[http://localhost:3000](http://localhost:3000).

To run on a different port:

```bash
PORT=4000 npm start
```

### Project Setup

- No build step and no runtime dependencies — plain Node.js with ES modules.
- All pages are rendered server-side by `server.js` (page templates in
  `js/pages.js`); the parser lives in `js/parser.js`.
- Documents are stored as JSON files in `data/` (created automatically,
  gitignored), share links in `data/links/`.

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
