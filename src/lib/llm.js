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
    `array of synonyms or empty array — synonyms must be words of the text language ${FROM}, ` +
    `never of ${TO}. Verify you output exactly the four keys and nothing else.`;
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

/* Models love markdown fences, trailing commas and duplicated object
   openers ("},\n  {\n  {"): exact-JSON extraction takes the outermost
   object, then cheap repairs run on failure. */
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
    const body = text.slice(start, end + 1);
    const repairs = [
      (s) => s,
      (s) => s.replace(/,(\s*[}\]])/g, "$1"),
      (s) => s.replace(/\{\s*\{/g, "{"),
      (s) => s.replace(/\}\s*\}/g, "}").replace(/,(\s*[}\]])/g, "$1"),
    ];
    for (const repair of repairs) {
      try {
        const candidate = repair(body);
        return JSON.parse(candidate);
      } catch {
        // next repair
      }
    }
    throw new Error("No valid JSON object found");
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
/* Generic OpenAI-compatible chat call: returns the message content. */
export async function chatCall(provider, system, user, timeoutMs = 15000, maxTokens = 2000, temperature = 0) {
  const headers = { "content-type": "application/json" };
  if (provider.key) {
    headers.authorization = `Bearer ${provider.key}`;
  }
  const res = await fetch(chatUrl(provider.base), {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: provider.model,
      stream: false,
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`HTTP \${res.status}`);
  }
  const content = (await res.json()).choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("LLM returned no content");
  }
  return content;
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
  const content = await chatCall(
    { ...provider, model },
    prompt.system,
    prompt.user,
    timeoutMs,
  );
  return validateLLMJson(parseLooseJson(content));
}

/* ---- test parts ---- */

const POINTS_SCHEMA = '{"points": string[]}';

export function eventsTruePrompt(text, language) {
  const LANGUAGE = NAMES[language] || "the text language";
  const system =
    `You read a text and answer in PLAIN TEXT only — no JSON, no markdown, ` +
    `no numbering, no bullet points, no comments about the task. Write 8 ` +
    `self-contained sentences about the TOPICS of the text below: each ` +
    `sentence expresses one main theme or idea of the text in your own ` +
    `words — never quote or lightly reword a single sentence of the text, ` +
    `instead say what the text is broadly about. Keep the order in which ` +
    `the topics appear. Every sentence is short and simple — at most 12 ` +
    `words. Each sentence ends with a period and stands on its ` +
    `own. Write everything in ${LANGUAGE} — the language of the text ` +
    `itself, never translate it.`;
  const user = `Text:\n\n${text}`;
  return { system, user };
}

export function eventsFalsePrompt(text, language) {
  const LANGUAGE = NAMES[language] || "the text language";
  const system =
    `You read a text and answer in PLAIN TEXT only — no JSON, no markdown, ` +
    `no numbering, no bullet points, no comments about the task. Write 8 ` +
    `self-contained sentences in ${LANGUAGE}, each describing a whole TOPIC ` +
    `that the text NEVER covers: an event, place, meeting or activity that ` +
    `the text says nothing about. Every sentence is short and simple — at ` +
    `most 12 words. Take care that every topic is new: do not ` +
    `restate, reword or negate anything the text says, and never mention ` +
    `the task itself. Each sentence ends with a period.`;
  const user = `Text:\n\n${text}`;
  return { system, user };
}

/* Order part: one summary sentence per main topic, topics keep the order
   in which the text raises them (this order is the true answer). */
export function orderTopicsPrompt(text, language) {
  const LANGUAGE = NAMES[language] || "the text language";
  const system =
    `You read a text and reply in PLAIN TEXT only — no JSON, no markdown, ` +
    `no numbering, no bullet points, no comments about the task. Write 5 ` +
    `self-contained sentences, each summing up one main topic of the text ` +
    `below in your own words — never quote a sentence of the text. Keep the ` +
    `order in which the topics appear in the text. Every sentence is short ` +
    `and simple — at most 12 words. Each sentence ends with ` +
    `a period and stands on its own. Write everything in ${LANGUAGE} — the ` +
    `language of the text itself, never translate it.`;
  const user = `Text:\n\n${text}`;
  return { system, user };
}

/* Plain replies are split into sentences (the model was asked for exactly
   six, one after another); numbered lists and near-repeats are dropped. */
export function splitFacts(raw, limit = 8) {
  const cleaned = String(raw).replace(/```[a-z]*|```/gi, "").trim();
  const parts = cleaned.split(/(?<=[.!?…])\s+/);
  const out = [];
  for (const part of parts) {
    const sentence = part.trim().replace(/^\d+[).:\-\s]+/, "").trim();
    if (foldKey(sentence).length < 12 || /[":]$/.test(sentence)) {
      continue;
    }
    if (out.some((s) => nearDuplicate(s, sentence))) {
      continue;
    }
    out.push(sentence);
    if (out.length >= limit) {
      break;
    }
  }
  return out;
}

/* One round of fact generation: the true and the false lists come from
   two independent plain-text requests, each retried once if unusable. */
export async function fetchFacts(provider, text, language, timeoutMs, maxTokens = 500) {
  const run = async (promptFn, retryNote, temperature, retryTemp) => {
    const prompt = promptFn(text, language);
    let list = [];
    try {
      list = splitFacts(
        await chatCall(provider, prompt.system, prompt.user, timeoutMs, maxTokens, temperature),
      );
    } catch {
      // retry below
    }
    if (list.length < 2) {
      try {
        list = splitFacts(
          await chatCall(
            provider,
            `${prompt.system} ${retryNote}`,
            prompt.user,
            timeoutMs,
            maxTokens,
            retryTemp,
          ),
        );
      } catch {
        // both attempts failed
      }
    }
    return list;
  };
  const truth = await run(
    eventsTruePrompt,
    "Reply with exactly 8 plain sentences that are in the text, written in the text language.",
    0.2,
    0.6,
  );
  const falsy = await run(
    eventsFalsePrompt,
    "Reply with exactly 8 plain sentences about events that are NOT in the text: new places, new meetings, new actions for these characters. Nothing from the text itself.",
    0.9,
    1.0,
  );
  return { true: truth, false: falsy };
};

export function validatePoints(obj) {
  const raw = Array.isArray(obj) ? obj : obj?.points;
  if (!Array.isArray(raw)) {
    throw new Error("No points array");
  }
  const seen = new Set();
  const points = [];
  for (const p of raw) {
    if (typeof p !== "string" || !p.trim()) {
      continue;
    }
    const key = p.trim().toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    points.push(p.trim());
  }
  if (points.length < 2) {
    throw new Error("Need at least 2 points");
  }
  return { points: points.slice(0, 6) };
}

export function questionsPrompt(text, language) {
  const LANGUAGE = NAMES[language] || "the text language";
  const system =
    `You read a text and reply with STRICT JSON only — no markdown, no prose, ` +
    `no comments about the task. JSON schema: {"questions": [{"question": ` +
    `string, "choices": string[], "answer": number}]}. Rules: write 4 questions ` +
    `about the events and details of the text, keeping the order of the text; ` +
    `every question and option is written in ${LANGUAGE} — the language of the ` +
    `text itself, never translate it; each "choices" array holds exactly 4 ` +
    `options with only one correct, all four of the same kind of thing (names, ` +
    `places, objects, actions); "answer" is the zero-based index of the correct ` +
    `option. Keep the questions and the options short and simple — about 12 ` +
    `words at most. Verify you output exactly the schema keys and nothing else.`;
  const user = `Text:\n\n${text}`;
  return { system, user };
}

export function validateQuestions(obj) {
  const raw = Array.isArray(obj) ? obj : obj?.questions;
  if (!Array.isArray(raw)) {
    throw new Error("No questions array");
  }
  const items = [];
  for (const item of raw) {
    if (!item || typeof item.question !== "string" || !item.question.trim()) {
      continue;
    }
    const choices = (Array.isArray(item.choices) ? item.choices : []).filter(
      (choice) => typeof choice === "string" && choice.trim(),
    );
    const answer = Number(item.answer);
    if (choices.length < 3 || !Number.isInteger(answer) ||
        answer < 0 || answer >= choices.length) {
      continue;
    }
    if (items.some((other) => nearDuplicate(other.question, item.question))) {
      continue;
    }
    items.push({
      question: item.question.trim(),
      choices: choices.slice(0, 4),
      answer: Math.min(answer, choices.slice(0, 4).length - 1),
    });
    if (items.length >= 4) {
      break;
    }
  }
  if (items.length < 2) {
    throw new Error("Need at least 2 usable questions");
  }
  return { questions: items };
}

export function translateLinesPrompt(sentences, from, to) {
  const FROM = NAMES[from] || "the source language";
  const TO = NAMES[to] || "the target language";
  const system =
    `You translate a numbered list of sentences and reply with STRICT JSON ` +
    `only — no markdown, no prose. JSON schema: {"translations": string[]}. ` +
    `Translate each input sentence from ${FROM} into ${TO}; keep the same ` +
    `order and the same number of items; plain natural sentences only, no ` +
    `numbering, no notes.`;
  const user = sentences.map((sentence, i) => `${i + 1}. ${sentence}`).join("\n");
  return { system, user };
}

/* Tolerate missing entries: unusable slots come back empty (""), the page
   simply shows no translation there. */
export function validateTranslations(obj, count) {
  const raw = Array.isArray(obj) ? obj : obj?.translations;
  if (!Array.isArray(raw)) {
    throw new Error("No translations array");
  }
  const translations = raw
    .slice(0, count)
    .map((item) => (typeof item === "string" ? item.trim() : ""));
  if (!translations.some(Boolean)) {
    throw new Error("No usable translations");
  }
  return { translations };
}

/* A sentence is duplicated when it differs only by punctuation/apostrophes
   or shares ~80% of its words (Levenshtein on the folded keys). */
export function foldKey(text) {
  return (text || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function levDistance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

export function nearDuplicate(a, b) {
  const ka = foldKey(a);
  const kb = foldKey(b);
  if (!ka || !kb) {
    return false;
  }
  if (ka === kb) {
    return true;
  }
  const ta = new Set(ka.split(" "));
  const tb = new Set(kb.split(" "));
  let inter = 0;
  for (const t of ta) {
    if (tb.has(t)) {
      inter += 1;
    }
  }
  const union = ta.size + tb.size - inter;
  if (union && inter / union >= 0.8) {
    return true;
  }
  const dist = levDistance(ka, kb);
  return dist <= 0.15 * Math.max(ka.length, kb.length);
}

export function validateEvents(obj) {
  const truthy = Array.isArray(obj) ? obj : obj?.true;
  const falsy = obj?.false;
  if (!Array.isArray(truthy) || !Array.isArray(falsy)) {
    throw new Error("No true/false arrays");
  }
  const statement = (s) => !/[?!]/u.test(s.trim().slice(-1));
  const truth = [];
  for (const s of truthy) {
    if (typeof s === "string" && s.trim() && statement(s) &&
        !truth.some((t) => nearDuplicate(t, s))) {
      truth.push(s.trim());
      if (truth.length >= 6) {
        break;
      }
    }
  }
  // false sentences that repeat a true one (even with other wording or a
  // swapped apostrophe) would give the same phrase two different answers
  const falseItems = [];
  for (const s of falsy) {
    if (typeof s !== "string" || !s.trim() || !statement(s)) {
      continue;
    }
    if (truth.some((t) => nearDuplicate(t, s)) ||
        falseItems.some((f) => nearDuplicate(f, s))) {
      continue;
    }
    falseItems.push(s.trim());
    if (falseItems.length >= 6) {
      break;
    }
  }
  if (truth.length < 2) {
    throw new Error("Need at least 2 distinct true sentences");
  }
  if (falseItems.length < 2) {
    throw new Error("Need at least 2 distinct false sentences");
  }
  return { true: truth, false: falseItems };
}

/* A stuttering or token-truncated model reply can still hold complete
   array elements: close the reply at every boundary position until it
   parses. */
export function salvageJsonText(raw, closers = ["]}", "]", "}"]) {
  if (!raw) {
    return null;
  }
  const start = raw.indexOf("{");
  if (start === -1) {
    return null;
  }
  const base = raw.slice(start);
  for (let cut = base.length; cut > 0; cut--) {
    if (cut < base.length && !"\"],}".includes(base[cut - 1])) {
      continue; // only close at element boundaries
    }
    for (const closer of closers) {
      const candidate = base.slice(0, cut) + closer;
      try {
        JSON.parse(candidate);
        return candidate;
      } catch {
        // next closer / next cut
      }
    }
  }
  return null;
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
