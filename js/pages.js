const LANGUAGES = [
  ["ru", "Russian"],
  ["fr", "French"],
  ["en-GB", "English (UK)"],
  ["en-US", "English (US)"],
  ["es", "Spanish"],
  ["it", "Italian"],
  ["de", "German"],
];

function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function languageSelect(id, label, selected) {
  const options = LANGUAGES.map(
    ([value, name]) =>
      `<option value="${value}"${value === selected ? " selected" : ""}>${name}</option>`,
  ).join("");
  return `
        <div class="field">
          <label for="${id}">${label}</label>
          <select id="${id}" name="${id}">
            <option value="" disabled${selected ? "" : " selected"}>Select</option>
            ${options}
          </select>
        </div>`;
}

export function layout(title, content, script = "") {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>notext — ${escapeHtml(title)}</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
${content}
${script ? `  <script type="module" src="${script}"></script>\n` : ""}</body>
</html>
`;
}

export function formPage(values = {}, error = "") {
  const langSelect = languageSelect("language", "Text language", values.language || "");
  const translationSelect = languageSelect(
    "translate_to",
    "Translation language",
    values.translate_to || "",
  );
  return layout(
    "new document",
    `  <header class="site-header">
    <span class="brand">notext</span>
    <span class="tagline">read &amp; translate to learn</span>
  </header>

  <main class="page">
    <form class="card" method="post" action="/read" enctype="multipart/form-data">
      <h1>New document</h1>
      <p class="muted">Type or paste text, or upload a file. Blank lines separate parts.</p>
${error ? `      <p class="status error">${escapeHtml(error)}</p>\n` : ""}
      <div class="field">
        <label for="title">Title</label>
        <input type="text" id="title" name="title" placeholder="Untitled" value="${escapeHtml(values.title || "")}">
      </div>

      <div class="row">
        <div class="field">
          <label for="date">Date</label>
          <input type="date" id="date" name="date" value="${escapeHtml(values.date || new Date().toISOString().slice(0, 10))}">
        </div>
${langSelect}${translationSelect}
      </div>

      <div class="field">
        <label for="text">Text</label>
        <textarea id="text" name="text" spellcheck="false"
          placeholder="Paste your text here…">${escapeHtml(values.text || "")}</textarea>
      </div>

      <div class="actions">
        <button type="submit" class="btn primary">Create</button>
        <button type="button" class="btn" id="btn-upload">Upload</button>
        <input type="file" id="file-input" name="file" accept=".txt,.md,text/plain" hidden>
        <span class="muted small" id="file-name">.txt / .md</span>
      </div>
    </form>
  </main>

  <footer class="site-footer">
    <span>notext · pages are rendered on the server</span>
  </footer>`,
  "/js/form.js",
  );
}

export function firstWords(doc, limit = 100) {
  const words = Object.keys(doc)
    .filter((key) => key.startsWith("part_"))
    .flatMap((key) => doc[key].sentences.flatMap((sentence) => sentence.words));
  return { text: words.slice(0, limit).join(" "), truncated: words.length > limit };
}

export function viewPage(id, doc) {
  const { text, truncated } = firstWords(doc, 100);
  const metaBits = [doc.language, doc.translate_to && `→ ${doc.translate_to}`]
    .filter(Boolean)
    .map(escapeHtml)
    .join(" · ");
  return layout(
    doc.title || "document",
    `  <header class="site-header">
    <span class="brand">notext</span>
    <span class="tagline">${metaBits}</span>
    <a class="nav-link" href="/">New text</a>
  </header>

  <main class="page doc-page">
    <div class="back-row"><a class="btn" href="/">Back</a></div>
    <article class="card">
      <h1>${escapeHtml(doc.title || "Untitled")}</h1>
      <p class="meta">${metaBits}</p>
      <p class="preview">${escapeHtml(text)}${truncated ? '<span class="muted"> …</span>' : ""}</p>
      <div class="actions">
        <a class="btn primary" href="/doc/${escapeHtml(id)}/read">Read</a>
        <a class="btn" href="/doc/${escapeHtml(id)}/share">Share</a>
      </div>
    </article>
  </main>

  <footer class="site-footer">
    <span>notext · pages are rendered on the server</span>
  </footer>`,
  );
}

export function readPage(id, doc) {
  const parts = Object.keys(doc)
    .filter((key) => key.startsWith("part_"))
    .map((key) => {
      const blocks = [
        `        <div class="block">
          <h2 class="part-title">${escapeHtml(key.replace(/^part_/, "Part "))}</h2>
          <button class="copy-btn" type="button">Copy</button>
        </div>`,
        ...doc[key].sentences.map(
          (sentence) => `        <div class="block">
          <p class="sentence">${escapeHtml(sentence.words.join(" "))}</p>
          <button class="copy-btn" type="button">Copy</button>
        </div>`,
        ),
      ].join("\n");
      return `      <section class="part">
${blocks}
      </section>`;
    })
    .join("\n");

  return layout(
    doc.title || "document",
    `  <header class="site-header">
    <span class="brand">notext</span>
    <span class="tagline">${escapeHtml(doc.title || "Untitled")}</span>
    <a class="nav-link" href="/doc/${escapeHtml(id)}/view">Preview</a>
  </header>

  <main class="page doc-page">
    <div class="back-row"><a class="btn" href="/doc/${escapeHtml(id)}/view">Back</a></div>
    <article class="card doc-card">
      <a class="btn begin-test" href="/doc/${escapeHtml(id)}/test">Begin testing</a>
      <h1>${escapeHtml(doc.title || "Untitled")}</h1>
${parts}
    </article>
  </main>

  <footer class="site-footer">
    <span>Hover a block to reveal its copy button</span>
  </footer>`,
  "/js/doc.js",
  );
}

export function jsonPage(id, raw) {
  return layout(
    "document json",
    `  <header class="site-header">
    <span class="brand">notext</span>
    <span class="tagline">raw json</span>
    <a class="nav-link" href="/doc/${escapeHtml(id)}/view">Preview</a>
  </header>

  <main class="page doc-page">
    <div class="card">
      <h1>Document JSON</h1>
      <pre class="json-view">${escapeHtml(raw)}</pre>
      <div class="actions">
        <a class="btn" href="/api/docs/${escapeHtml(id)}">Raw JSON</a>
      </div>
    </div>
  </main>

  <footer class="site-footer">
    <span>notext · pages are rendered on the server</span>
  </footer>`,
  );
}

export function sharePage(id, url) {
  return layout(
    "share document",
    `  <header class="site-header">
    <span class="brand">notext</span>
    <span class="tagline">share</span>
    <a class="nav-link" href="/doc/${escapeHtml(id)}/view">Preview</a>
  </header>

  <main class="page doc-page">
    <div class="back-row"><a class="btn" href="/doc/${escapeHtml(id)}/view">Back</a></div>
    <div class="card">
      <h1>Share this text</h1>
      <p class="muted">Anyone with this link can read it.</p>
      <input type="text" id="share-link" class="link-box" readonly value="${escapeHtml(url)}">
      <div class="actions">
        <button type="button" class="btn primary" id="share-copy">Copy link</button>
        <a class="btn" href="${escapeHtml(url)}" target="_blank" rel="noopener">Open link</a>
      </div>
    </div>
  </main>

  <footer class="site-footer">
    <span>notext · pages are rendered on the server</span>
  </footer>`,
  "/js/share.js",
  );
}

export function testPage(id, doc) {
  return layout(
    "testing",
    `  <header class="site-header">
    <span class="brand">notext</span>
    <span class="tagline">testing</span>
    <a class="nav-link" href="/doc/${escapeHtml(id)}/view">Preview</a>
  </header>

  <main class="page doc-page">
    <div class="card">
      <h1>${escapeHtml(doc.title || "Untitled")}</h1>
      <div class="actions">
        <a class="btn" href="/doc/${escapeHtml(id)}/read">Back</a>
        <a class="btn primary" href="/doc/${escapeHtml(id)}/test/result">Finish</a>
      </div>
    </div>
  </main>

  <footer class="site-footer">
    <span>notext · pages are rendered on the server</span>
  </footer>`,
  );
}

export function testResultPage(id, doc) {
  return layout(
    "test results",
    `  <header class="site-header">
    <span class="brand">notext</span>
    <span class="tagline">test results</span>
    <a class="nav-link" href="/doc/${escapeHtml(id)}/view">Preview</a>
  </header>

  <main class="page doc-page">
    <div class="card">
      <h1>Results</h1>
      <p class="muted">${escapeHtml(doc.title || "Untitled")}</p>
      <div class="actions">
        <a class="btn primary" href="/">To main page</a>
      </div>
    </div>
  </main>

  <footer class="site-footer">
    <span>notext · pages are rendered on the server</span>
  </footer>`,
  );
}

export function notFoundPage() {
  return layout(
    "not found",
    `  <header class="site-header">
    <span class="brand">notext</span>
  </header>

  <main class="page">
    <div class="card">
      <h1>Page not found</h1>
      <p class="muted">The document you are looking for does not exist.</p>
      <div class="actions">
        <a class="btn primary" href="/">New text</a>
      </div>
    </div>
  </main>

  <footer class="site-footer">
    <span>notext · pages are rendered on the server</span>
  </footer>`,
  );
}
