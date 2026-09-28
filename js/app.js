import { parseText, buildStats } from "./parser.js";

const els = {
  form: document.getElementById("text-form"),
  title: document.getElementById("field-title"),
  date: document.getElementById("field-date"),
  language: document.getElementById("field-language"),
  text: document.getElementById("field-text"),
  upload: document.getElementById("btn-upload"),
  file: document.getElementById("file-input"),
  output: document.getElementById("json-output"),
  copy: document.getElementById("btn-copy"),
  download: document.getElementById("btn-download"),
  status: document.getElementById("status-msg"),
  stats: document.getElementById("stats"),
};

let currentDoc = null;

function setStatus(message, kind = "") {
  els.status.textContent = message;
  els.status.className = kind;
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlightJson(json) {
  return escapeHtml(json)
    .replace(/"([^"\\]|\\.)*"(?=\s*:)/g, (m) => `<span class="j-key">${m}</span>`)
    .replace(/: ("(?:[^"\\]|\\.)*")/g, (m, s) => `: <span class="j-str">${s}</span>`);
}

function renderDoc(doc) {
  currentDoc = doc;
  els.output.innerHTML = highlightJson(JSON.stringify(doc, null, 2));
  els.output.classList.remove("empty");
  els.copy.hidden = false;
  els.download.hidden = false;

  const stats = buildStats(doc);
  els.stats.textContent = `parts: ${stats.parts} | sentences: ${stats.sentences} | words: ${stats.words}`;
}

function handleParse(sourceText, origin) {
  const text = sourceText.trim();
  if (!text) {
    setStatus(`error: ${origin} is empty`, "error");
    return;
  }
  if (!els.language.value) {
    setStatus("error: select language", "error");
    els.language.focus();
    return;
  }

  const doc = parseText(text, {
    title: els.title.value.trim(),
    date: els.date.value,
    language: els.language.value,
  });

  renderDoc(doc);
  setStatus(`done: parsed ${origin}`, "ok");
}

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  handleParse(els.text.value, "text");
});

els.upload.addEventListener("click", () => els.file.click());

els.file.addEventListener("change", async () => {
  const file = els.file.files[0];
  if (!file) return;

  if (file.name.toLowerCase().endsWith(".json")) {
    try {
      const doc = JSON.parse(await file.text());
      renderDoc(doc);
      setStatus(`done: loaded ${file.name}`, "ok");
    } catch {
      setStatus(`error: ${file.name} is not valid json`, "error");
    }
  } else {
    const text = await file.text();
    els.text.value = text;
    handleParse(text, file.name);
  }

  els.file.value = "";
});

els.copy.addEventListener("click", async () => {
  if (!currentDoc) return;
  try {
    await navigator.clipboard.writeText(JSON.stringify(currentDoc, null, 2));
    setStatus("done: copied to clipboard", "ok");
  } catch {
    setStatus("error: clipboard unavailable", "error");
  }
});

els.download.addEventListener("click", () => {
  if (!currentDoc) return;
  const slug =
    els.title.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") ||
    "notext";
  const blob = new Blob([JSON.stringify(currentDoc, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug}_${els.date.value || "undated"}.json`;
  a.click();
  URL.revokeObjectURL(url);
  setStatus(`done: saved ${a.download}`, "ok");
});

els.text.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    els.form.requestSubmit();
  }
});

els.date.value = new Date().toISOString().slice(0, 10);
setStatus("ready", "ok");
