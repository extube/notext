import { json } from "@sveltejs/kit";
import { loadSettings, languageName } from "$lib/server/settings.js";

const TIMEOUT_MS = 6000;
const LLM_TIMEOUT_MS = 45000;

function stripPunctuation(word) {
  const m = word.match(/^[\p{L}\p{M}''’-]+/u);
  return m ? m[0] : "";
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

async function fetchText(url, body, timeout = LLM_TIMEOUT_MS) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.text();
}

/* Local OpenAI-compatible LLM: llama.cpp, vLLM, OVMS, LM Studio… The model
   id must match the server's; pick the first entry of /v1/models and fall
   back to a neutral name (llama.cpp ignores the id). */
async function resolveModelId(settings) {
  const { host, port } = settings.llm;
  try {
    const data = await fetchJson(
      `http://${host}:${port}/v1/models`,
      5000,
    );
    const id = data?.data?.[0]?.id;
    if (id) {
      return id;
    }
  } catch {
    // fall through to the default id
  }
  return "local-model";
}

async function lookupWithLLM(word, sentence, from, to) {
  const settings = loadSettings();
  const model = await resolveModelId(settings);
  const { host, port } = settings.llm;
  const url = `http://${host}:${port}/v1/chat/completions`;

  const schema =
    '{"translation": string, "meaning": string, "synonyms": string[], "part_of_speech": string}';
  const system =
    `You look up a word in context and reply with STRICT JSON only — no markdown, no prose. ` +
    `JSON schema: ${schema}. Rules: 'translation' translates the word to ${languageName(to)} ` +
    `(empty string if unknown); 'meaning' is a short description of what the word means in ` +
    `this exact sentence in ${languageName(from)} (empty string if unknown); 'synonyms' is an ` +
    `array of synonyms or empty array; 'part_of_speech' is the part of speech in the sentence ` +
    `(empty string if unknown).`;
  const user =
    `Text language: ${languageName(from)}\n` +
    `Translating to: ${languageName(to)}\n` +
    `Sentence: ${sentence}\n` +
    `Word: ${word}`;

  const body = {
    model,
    stream: false,
    temperature: 0,
    max_tokens: 400,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };

  const content = JSON.parse(await fetchText(url, body)).choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("LLM returned no content");
  }
  return validateLLMJson(parseLooseJson(content));
}

/* Models love markdown fences; exact-JSON extraction: outermost object. */
function parseLooseJson(content) {
  const text = content.replace(/```json|```/gi, "").trim();
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) {
      throw new Error("No JSON object found");
    }
    return JSON.parse(text.slice(start, end + 1));
  }
}

function validateLLMJson(obj) {
  if (!obj || typeof obj !== "object") {
    throw new Error("JSON is not an object");
  }
  if (typeof obj.translation !== "string") {
    throw new Error("JSON field 'translation' missing");
  }
  for (const field of ["meaning", "part_of_speech"]) {
    if (obj[field] !== undefined && typeof obj[field] !== "string") {
      throw new Error(`JSON field '${field}' must be a string`);
    }
  }
  if (obj.synonyms !== undefined) {
    if (!Array.isArray(obj.synonyms) || obj.synonyms.some((s) => typeof s !== "string")) {
      throw new Error("JSON field 'synonyms' must be a string array");
    }
  }
  return {
    translation: obj.translation || null,
    meaning: obj.meaning || null,
    synonyms: obj.synonyms?.length ? obj.synonyms : null,
    part_of_speech: obj.part_of_speech || null,
  };
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

  // local LLM first: it handles whole units (multi-word) and context
  if (sentence) {
    try {
      const llm = await lookupWithLLM(word, sentence, from, to);
      const transcription = await transcribe(word, from);
      return json({ word, ...llm, transcription, source: "local-llm" });
    } catch (error) {
      console.error(`local LLM lookup failed: ${error.message}`);
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
