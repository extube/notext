import { json } from "@sveltejs/kit";

const TIMEOUT_MS = 6000;

function stripPunctuation(word) {
  const m = word.match(/^[\p{L}\p{M}''’-]+/u);
  return m ? m[0] : "";
}

function baseCode(lang) {
  return (lang || "").split("-")[0];
}

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
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
  // single-word en lookup has the best structured API
  if (baseCode(lang) === "en") {
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

  // Wiktionary OCR of wikitext templates; native wiki first, then en wiki
  for (const code of [baseCode(lang), "en"]) {
    if (!code || code === "en" && baseCode(lang) === "en") {
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

  if (!word || !from) {
    return json({ translation: null, transcription: null });
  }

  const [translationResult, transcriptionResult] = await Promise.allSettled([
    translate(word, from, to),
    transcribe(word, from),
  ]);
  const translation =
    translationResult.status === "fulfilled" ? translationResult.value : null;
  const transcription =
    transcriptionResult.status === "fulfilled" ? transcriptionResult.value : null;

  return json({ translation, transcription });
}
