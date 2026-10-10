import { json } from "@sveltejs/kit";
import { loadDoc, patchDoc } from "$lib/server/storage.js";
import { siteProvider } from "$lib/server/llm-site.js";
import { chatCall, detectModel, parseLooseJson, quizPrompt, validateQuiz } from "$lib/llm.js";
import { isPunctUnit, joinWords } from "$lib/text.js";

const GENERATE_TIMEOUT_MS = 120000;

/* Flatten the stored doc into plain text: sentences joined with spaces
   (matches what the reader shows), blank lines between parts. */
function docText(doc) {
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

/* Offline fallback: fill-the-gap questions taken straight from the stored
   units. Any random unittest is the answer. */
function deterministicQuiz(doc) {
  const seen = new Set();
  const questions = [];
  outer: for (const key of Object.keys(doc).sort()) {
    if (!key.startsWith("part_")) {
      continue;
    }
    for (const sentence of doc[key].sentences) {
      const units = sentence.words.filter(
        (w) => !isPunctUnit(w) && w.length > 2,
      );
      if (units.length < 3) {
        continue;
      }
      const answer = units[Math.floor(Math.random() * units.length)];
      if (seen.has(answer.toLowerCase())) {
        continue;
      }
      seen.add(answer.toLowerCase());
      const template = joinWords(sentence.words).replace(answer, "[___]");
      questions.push({ type: "cloze", template, answer: [answer] });
      if (questions.length >= 6) {
        break outer;
      }
    }
  }
  if (!questions.length) {
    throw new Error("Text is too short for a quiz");
  }
  return { questions };
}

/* A stuttering or token-truncated model reply can still contain complete
   questions: cut back to the last fully closed object and close the array. */
function salvageQuizText(raw) {
  if (!raw) {
    return null;
  }
  const start = raw.indexOf("{");
  if (start === -1) {
    return null;
  }
  for (let cut = raw.length - 1; cut > start; cut--) {
    if (raw[cut] !== "}") {
      continue;
    }
    const candidate = raw.slice(start, cut + 1) + "]}";
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // try the previous closing brace
    }
  }
  return null;
}

export async function POST({ request, url }) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    // hidden form posts pass query params instead
  }
  const id = String(body.id || url.searchParams.get("id") || "");
  const raw = loadDoc(id);
  if (raw === null) {
    return json({ error: "Document not found" }, { status: 404 });
  }
  const doc = JSON.parse(raw);

  // user-L generated quiz handed over from the browser
  if (body.quiz) {
    try {
      const quiz = validateQuiz(body.quiz);
      const entry = {
        part: "understanding",
        source: "user-llm",
        created: new Date().toISOString().slice(0, 10),
        quiz,
      };
      const test = { ...doc.test, [entry.part]: entry };
      patchDoc(id, { test });
      return json({ ...entry });
    } catch (error) {
      return json({ error: `Invalid quiz: ${error.message}` }, { status: 400 });
    }
  }

  // already generated? (open again → load the stored json)
  const existing = doc.test?.understanding;
  const regenerate = body.regenerate === true ||
    (url.searchParams.get("regenerate") || "") === "1";
  if (existing?.quiz && !regenerate) {
    return json(existing);
  }

  const text = docText(doc);
  try {
    const provider = await siteProvider();
    if (!provider) {
      throw new Error("No site LLM configured");
    }
    let model = provider.model;
    if (!model) {
      model = await detectModel({ base: provider.base, key: provider.key });
    }
    const prompt = quizPrompt(text, doc.translate_to || doc.language);
    let rawQuiz = await chatCall(
      { ...provider, model },
      prompt.system,
      prompt.user,
      GENERATE_TIMEOUT_MS,
      8000,
    );
    let quiz;
    try {
      quiz = validateQuiz(parseLooseJson(rawQuiz));
    } catch {
      // salvage complete objects out of a truncated reply
      const salvaged = salvageQuizText(rawQuiz);
      if (!salvaged) {
        throw new Error("Unparseable quiz reply");
      }
      quiz = validateQuiz(parseLooseJson(salvaged));
    }
    const entry = {
      part: "understanding",
      source: model,
      created: new Date().toISOString().slice(0, 10),
      quiz,
    };
    const test = { ...doc.test, [entry.part]: entry };
    patchDoc(id, { test });
    return json(entry);
  } catch (error) {
    console.error(`understanding quiz generation failed: ${error.message}`);
    // last resort server-side: deterministic quiz stored the same way
    try {
      const quiz = validateQuiz(deterministicQuiz(doc));
      const entry = {
        part: "understanding",
        source: "deterministic",
        created: new Date().toISOString().slice(0, 10),
        quiz,
      };
      const test = { ...doc.test, [entry.part]: entry };
      patchDoc(id, { test });
      return json({ ...entry, fallback: true, text });
    } catch (fallbackError) {
      return json(
        { error: `Quiz generation failed: ${fallbackError.message}` },
        { status: 500 },
      );
    }
  }
}
