/* Client-safe LLM helpers shared by the server /api/word route and the
   browse-side user-provider request path (parser.js must stay server-only,
   but this module must work in both environments — no Node APIs). */

const SCHEMA =
  '{"translation": string, "part_of_speech": string, "form": string, "synonyms": string[]}';

export function buildPrompt(word, sentence, from, to) {
  const FROM = NAMES[from] || "the source language";
  const TO = NAMES[to] || "the target language";
  const system =
    `You look up a word in context and reply with STRICT JSON only — no markdown, no prose. ` +
    `JSON schema: ${SCHEMA}. Rules: 'translation' translates the word to ${TO} (empty string ` +
    `if unknown); 'part_of_speech' is the part of speech of the word in the sentence (empty ` +
    `string if unknown); 'form' is the grammatical form the word takes in this sentence, e.g. ` +
    `"plural", "past tense", "prepositional case" (empty string if unknown); 'synonyms' is an ` +
    `array of synonyms or empty array. Verify you output exactly the four keys and nothing else.`;
  const user =
    `Text language: ${FROM}\n` +
    `Translating to: ${TO}\n` +
    `Sentence: ${sentence}\n` +
    `Word: ${word}`;
  return { system, user };
}

const NAMES = {
  ru: "Russian",
  fr: "French",
  "en-GB": "English (UK)",
  "en-US": "English (US)",
  es: "Spanish",
  it: "Italian",
  de: "German",
};

/* Normalized OpenAI-compatible provider: base ends with /v1 (or the
   provider's equal), the chat call is `${base}/chat/completions`. */
export function chatUrl(base) {
  return `${(base || "").trim().replace(/\/$/, "")}/chat/completions`;
}

/* Models love markdown fences: extract the outermost object. */
export function parseLooseJson(content) {
  const text = String(content).replace(/```json|```/gi, "").trim();
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

export function validateLLMJson(obj) {
  if (!obj || typeof obj !== "object") {
    throw new Error("JSON is not an object");
  }
  if (typeof obj.translation !== "string") {
    throw new Error("JSON field 'translation' missing");
  }
  for (const field of ["part_of_speech", "form"]) {
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
    part_of_speech: obj.part_of_speech || null,
    form: obj.form || null,
    synonyms: obj.synonyms?.length ? obj.synonyms : null,
  };
}

/* provider = { base, key, model } (key/model may be empty). A missing
   model id is auto-detected from /v1/models (llama.cpp ignores the id,
   OVMS-like servers require a match). */
export async function chatLookup(provider, word, sentence, from, to, timeoutMs = 15000) {
  let model = provider.model;
  if (!model) {
    model = await detectModel({ base: provider.base, key: provider.key }).catch(
      () => "local-model",
    );
  }
  const prompt = buildPrompt(word, sentence, from, to);
  const headers = { "content-type": "application/json" };
  if (provider.key) {
    headers.authorization = `Bearer ${provider.key}`;
  }
  const res = await fetch(chatUrl(provider.base), {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      stream: false,
      temperature: 0,
      max_tokens: 400,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const content = (await res.json()).choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("LLM returned no content");
  }
  return validateLLMJson(parseLooseJson(content));
}

/* Pick a model id from /v1/models (llama.cpp ignores it, OVMS/Local stacks
   require a match). Returns the first id, or throws on failure. */
export async function detectModel(provider, timeoutMs = 5000) {
  const url = chatUrl(provider.base).replace(/chat\/completions$/, "models");
  const headers = {};
  if (provider.key) {
    headers.authorization = `Bearer ${provider.key}`;
  }
  const res = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const id = (await res.json())?.data?.[0]?.id;
  if (!id) {
    throw new Error("No models found");
  }
  return id;
}
