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
export async function chatCall(provider, system, user, timeoutMs = 15000, maxTokens = 2000) {
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
      temperature: 0,
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

/* ---- understanding quiz ---- */

const QUIZ_SCHEMA =
  '{"questions": [{"type": "mc", "question": string, "options": string[], "answer": number}, ' +
  '{"type": "cloze", "template": string, "answer": string[]}, ' +
  '{"type": "open", "question": string, "answer": string, "keywords": string[]}]}';

export function quizPrompt(text, to) {
  const TO = NAMES[to] || "the target language";
  const system =
    `You create a comprehension test for a text and reply with STRICT JSON only — ` +
    `no markdown, no prose. JSON schema: ${QUIZ_SCHEMA}. Create 8 questions about the text ` +
    `below: 4 "mc" (multiple choice with 3-4 options, "answer" is the 0-based index of the ` +
    `correct option), 2 "cloze" (take a sentence from the text and replace exactly one word ` +
    `with [___], "answer" is the array of accepted words that fit the gap — keep the rest of ` +
    `the sentence unchanged), 2 "open" ("question" needs a one-sentence answer, "answer" is ` +
    `an exemplary full answer, "keywords" are 1-4 key words that must appear in a correct ` +
    `answer). Questions, options, answers and keywords must be in ${TO}. The cloze ` +
    `[___] replaces a word of the original text. Verify you output exactly one JSON object ` +
    `with one "questions" array.`;
  const user = `Text:

${text}`;
  return { system, user };
}

export function validateQuiz(obj) {
  if (!obj || typeof obj !== "object") {
    throw new Error("Quiz JSON is not an object");
  }
  const raw = Array.isArray(obj) ? obj : obj.questions;
  if (!Array.isArray(raw) || !raw.length) {
    throw new Error("Quiz has no questions");
  }
  const quiz = [];
  for (const q of raw) {
    if (!q || typeof q !== "object" || typeof q.type !== "string") {
      continue;
    }
    if (q.type === "mc") {
      if (!Array.isArray(q.options) || q.options.length < 2 ||
          !Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length ||
          !q.options.every((o) => typeof o === "string")) {
        continue;
      }
      if (typeof q.question !== "string" || !q.question.trim()) {
        continue;
      }
      quiz.push({
        type: "mc",
        question: q.question,
        options: q.options,
        answer: q.answer,
      });
    } else if (q.type === "cloze") {
      if (typeof q.template !== "string" ||
          !/\[?_{2,3}\]?/.test(q.template) ||
          !Array.isArray(q.answer) || !q.answer.length ||
          !q.answer.every((a) => typeof a === "string" && a.trim())) {
        continue;
      }
      quiz.push({
        type: "cloze",
        template: q.template.replace(/\[?_{2,3}\]?/, "[___]"),
        answer: q.answer.map((a) => a.trim()).filter(Boolean),
      });
    } else if (q.type === "open") {
      if (typeof q.question !== "string" || !q.question.trim() ||
          !Array.isArray(q.keywords) || !q.keywords.length ||
          !q.keywords.every((k) => typeof k === "string")) {
        continue;
      }
      quiz.push({
        type: "open",
        question: q.question,
        answer: typeof q.answer === "string" ? q.answer : "",
        keywords: q.keywords.map((k) => k.trim().toLowerCase()).filter(Boolean),
      });
    }
  }
  if (!quiz.length) {
    throw new Error("Quiz has no valid questions");
  }
  return { questions: quiz };
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
