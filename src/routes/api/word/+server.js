import { json } from "@sveltejs/kit";
import { siteProvider } from "$lib/server/llm-site.js";
import { chatLookup } from "$lib/llm.js";

const TIMEOUT_MS = 6000;
const LLM_TIMEOUT_MS = 45000;

/* Trim outer punctuation, keep the whole unit intact — lookup units are
   often multi-word ("les journaux", "в лесу", "a book"). */
function stripPunctuation(word) {
  return (word || "")
    .replace(/^[^\p{L}\p{M}''’]+/u, "")
    .replace(/[^\p{L}\p{M}''’]+$/u, "");
}

function baseCode(lang) {
  return (lang || "").split("-")[0];
}

async function fetchJson(url, timeout = TIMEOUT_MS) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeout) });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

async function translate(word, from, to) {
  if (!word || !from || !to) {
    return null;
  }
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=${from}|${to}`;
  const data = await fetchJson(url);
  const text = data?.responseData?.translatedText;
  if (!text || /^(INVALID|MYMEMORY WARNING|QUERY LENGTH)/i.test(text)) {
    return null;
  }
  return text;
}

async function transcribe(word, lang) {
  // structured API covers single en-words best
  if (baseCode(lang) === "en" && /^\p{L}+$/u.test(word)) {
    try {
      const entries = await fetchJson(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      );
      for (const entry of entries) {
        const phonetic =
          entry.phonetic ||
          (entry.phonetics || []).map((p) => p.text).find(Boolean);
        if (phonetic) {
          return phonetic;
        }
      }
    } catch {
      // fall through to Wiktionary
    }
  }

  // Wiktionary wikitext templates; native wiki first, then en wiki
  for (const code of [baseCode(lang), "en"]) {
    if (!code || (code === "en" && baseCode(lang) === "en")) {
      continue;
    }
    try {
      const data = await fetchJson(
        `https://${code}.wiktionary.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=revisions&rvslots=main&rvprop=content&titles=${encodeURIComponent(word)}`,
      );
      const pages = data?.query?.pages || {};
      for (const page of Object.values(pages)) {
        const content = page?.revisions?.[0]?.slots?.main?.["*"];
        if (!content) {
          continue;
        }
        const phonetic = extractPhonetic(content);
        if (phonetic) {
          return phonetic;
        }
      }
    } catch {
      // try next source
    }
  }
  return null;
}

function extractPhonetic(content) {
  const templates = content.match(/\{\{[\w-]*(?:IPA[0-9]?|pron|API|fr-rég|pronunciación|Lautschrift|AS)\|[^}]*\}\}/gi) || [];
  for (const template of templates) {
    const body = template.match(/\{\{[^|]+\|(.*)\}\}/)?.[1];
    if (!body) {
      continue;
    }
    const found = body.match(/\/([^/]+)\//) || body.match(/\[([^\]]+)\]/);
    if (!found) {
      continue;
    }
    const phonetic = found[1].trim();
    // IPA never contains Cyrillic or accented word forms like "приве́т"
    if (phonetic && !/[\u0400-\u04FF]/.test(phonetic)) {
      return `/${phonetic}/`;
    }
  }
  return null;
}

export async function GET({ url, setHeaders }) {
  setHeaders({ "cache-control": "no-store" });

  const word = stripPunctuation(url.searchParams.get("q") || "");
  const from = baseCode(url.searchParams.get("lang") || "");
  const to = baseCode(url.searchParams.get("to") || "");
  const sentence = (url.searchParams.get("sentence") || "").trim();

  if (!word || !from) {
    return json({ translation: null, transcription: null });
  }

  if (sentence) {
    const provider = await siteProvider();
    if (provider) {
      try {
        const llm = await chatLookup(provider, word, sentence, from, to, LLM_TIMEOUT_MS);
        const transcription = await transcribe(word, from);
        return json({ word, ...llm, transcription, source: provider.model });
      } catch (error) {
        console.error(`LLM lookup failed (${provider.model}): ${error.message}`);
      }
    }
  }

  const [translationResult, transcriptionResult] = await Promise.allSettled([
    translate(word, from, to),
    transcribe(word, from),
  ]);
  const translation =
    translationResult.status === "fulfilled" ? translationResult.value : null;
  const transcription =
    transcriptionResult.status === "fulfilled" ? transcriptionResult.value : null;

  return json({ word, translation, transcription, source: "services" });
}
