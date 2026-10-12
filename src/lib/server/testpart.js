import { loadDoc, patchDoc } from "$lib/server/storage.js";
import { siteProvider } from "$lib/server/llm-site.js";
import { chatCall, detectModel } from "$lib/llm.js";
import { joinWords } from "$lib/text.js";

export const GENERATE_TIMEOUT_MS = 240000;

/* Flatten the stored doc into plain text: sentences joined with spaces
   (matches what the reader shows), blank lines between parts. */
export function docText(doc) {
  const parts = [];
  for (const key of Object.keys(doc).sort()) {
    if (!key.startsWith("part_")) {
      continue;
    }
    parts.push(
      doc[key].sentences
        .map((sentence) => joinWords(sentence.words))
        .join(" "),
    );
  }
  return parts.join("\n\n") || (doc.title || "");
}

/* Every test endpoint answers the same POST contract: {id, ...} with the
   user's browser-side generation handed over as the part's own payload. */
export async function readRequest(request, url) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    // hidden form posts pass query params instead
  }
  return {
    body,
    id: String(body.id || url.searchParams.get("id") || ""),
    regenerate:
      body.regenerate === true ||
      (url.searchParams.get("regenerate") || "") === "1",
  };
}

export function loadParsedDoc(id) {
  const raw = id ? loadDoc(id) : null;
  return raw === null ? null : JSON.parse(raw);
}

/* Site LLM only (data/settings.json): users' own APIs live client-side. */
export async function siteModelProvider() {
  const provider = await siteProvider();
  if (!provider) {
    throw new Error("No site LLM configured");
  }
  let model = provider.model;
  if (!model) {
    model = await detectModel({ base: provider.base, key: provider.key });
  }
  return { ...provider, model };
}

export async function generateWithSite(text, prompt, maxTokens = 8000) {
  const provider = await siteModelProvider();
  const raw = await chatCall(
    provider,
    prompt.system,
    prompt.user,
    GENERATE_TIMEOUT_MS,
    maxTokens,
  );
  return { raw, model: provider.model };
}

/* Store the part entry, quietly dropping any legacy quiz entry. */
export function storeEntry(id, doc, part, entry) {
  const test = { ...doc.test, [part]: entry };
  delete test.understanding;
  patchDoc(id, { test });
}

export function nowCreated() {
  return new Date().toISOString().slice(0, 10);
}

/* Solved-round score handed over from the browser: {correct, total}. */
export function readScore(body) {
  const score = body?.score;
  if (!score) {
    return null;
  }
  const correct = Number(score.correct);
  const total = Number(score.total);
  if (!Number.isInteger(correct) || !Number.isInteger(total) ||
      total < 1 || total > 100 || correct < 0 || correct > total) {
    throw new Error("Invalid score payload");
  }
  return { correct, total };
}

/* Sentences of the doc in reading order (deduped, case-insensitive). */
export function docSentences(doc) {
  const seen = new Set();
  const out = [];
  for (const text of docText(doc).split(/\n+/)) {
    for (const sentence of text.split(/(?<=[.!?…])\s+/)) {
      const clean = sentence.trim();
      if (clean.length < 12) {
        continue;
      }
      const key = clean.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      out.push(clean);
    }
  }
  return out;
}

/* Order part: up to 6 sentences picked evenly across the whole text, in
   text order — the reformulations keep that order as the true answer. */
export function spreadSentences(doc, limit = 6) {
  const all = docSentences(doc);
  const picked = [];
  for (let i = 0; i < limit && all.length; i++) {
    const index = all.length <= limit
      ? i
      : Math.floor((i * (all.length - 1)) / (limit - 1));
    const sentence = all[index];
    if (sentence && !picked.includes(sentence)) {
      picked.push(sentence);
    }
  }
  return picked;
}
