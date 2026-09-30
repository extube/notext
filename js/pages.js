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
        <button type="submit" class="btn primary">Read</button>
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

export function docPage(doc) {
  const parts = Object.keys(doc)
    .filter((key) => key.startsWith("part_"))
    .map((key) => {
      const sentences = doc[key].sentences
        .map(
          (sentence) =>
            `        <p class="sentence" title="Click to copy sentence">${sentence.words
              .map((word) => `<span class="word">${escapeHtml(word)}</span>`)
              .join(" ")}</p>`,
        )
        .join("\n");
      return `      <section class="part">
        <h2 class="part-title">${escapeHtml(key.replace(/^part_/, "Part "))}</h2>
${sentences}
      </section>`;
    })
    .join("\n");

  const metaBits = [doc.date, doc.language, doc.translate_to && `→ ${doc.translate_to}`]
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
    <article class="card doc-card">
      <h1>${escapeHtml(doc.title || "Untitled")}</h1>
${parts}
    </article>
  </main>

  <footer class="site-footer">
    <span>Click a sentence to copy it · click a word to select it</span>
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
    <a class="nav-link" href="/doc/${escapeHtml(id)}">Open document</a>
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
