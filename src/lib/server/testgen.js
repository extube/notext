/* Test part generators + the background build task. Each generator returns
   the entry stored under doc.test.<key>; every failure degrades to a
   deterministic fallback so a build almost always completes (a text too
   small to test marks an error on the progress bar). The build runs as an
   async server task and stores every part into the document json the moment
   it is ready — a page reload lands again on the same stage and only the
   still missing parts run. */

import {
  GENERATE_TIMEOUT_MS,
  docSentences,
  docText,
  loadParsedDoc,
  nowCreated,
  siteModelProvider,
  spreadSentences,
  storeEntry,
} from "$lib/server/testpart.js";
import {
  chatCall,
  cleanReformulation,
  fetchFacts,
  foldKey,
  parseLooseJson,
  questionsPrompt,
  reformulatePrompt,
  salvageJsonText,
  translateLinesPrompt,
  usableReformulation,
  validateEvents,
  validateQuestions,
  validateTranslations,
} from "$lib/llm.js";

export const STAGES = [
  { key: "order", label: "test part 1 · order" },
  { key: "events", label: "test part 2 · events" },
  { key: "questions", label: "test part 3 · questions" },
  { key: "arrange", label: "test part 4 · arrange" },
];

/* A stage counts as done when its stored entry is playable. */
function partDone(test, key) {
  const entry = test?.[key];
  if (key === "order") {
    return Boolean(entry?.points?.length);
  }
  if (key === "events") {
    return Boolean(entry?.true?.length && entry?.false?.length);
  }
  return Boolean(entry?.items?.length);
}

/* Models love markdown fences and stuttering tails: try ordinary loose
   parsing, then close the reply at the best array boundary. */
function tryJson(raw) {
  try {
    return parseLooseJson(raw);
  } catch {
    const salvaged = salvageJsonText(raw);
    if (!salvaged) {
      return null;
    }
    try {
      return JSON.parse(salvaged);
    } catch {
      return null;
    }
  }
}

/* Events must be invented: a "false" item that quotes 6 consecutive words
   of the text is text material, not imagination (shorter overlapping
   fragments are common openings, not evidence of copying). */
export function notFromText(sentences, corpus) {
  return sentences.filter((sentence) => {
    const words = foldKey(sentence).split(/\s+/).filter(Boolean);
    for (let i = 0; i + 6 <= words.length; i++) {
      if (corpus.includes(words.slice(i, i + 6).join(" "))) {
        return false;
      }
    }
    return true;
  });
}

/* Deterministic false sentences: recombine comma-separated clauses from
   two different sentences — a plausible claim that is not in the text,
   and never a shuffled copy of one true sentence. */
function recombined(sentence, other, taken) {
  const splitClauses = (text) =>
    text.split(/,\s*/).map((part) => part.trim()).filter(
      (part) => part.length > 8 && part.split(/\s+/).length >= 3,
    );
  const a = splitClauses(sentence);
  const b = splitClauses(other);
  if (a.length < 2 || b.length < 2) {
    return null;
  }
  const wrong =
    a.slice(0, Math.ceil(a.length / 2)).join(", ") +
    ", " +
    b.slice(Math.ceil(b.length / 2)).join(", ");
  if (!taken.has(wrong.toLowerCase())) {
    return /[\p{P}]$/u.test(wrong) ? wrong : `${wrong}.`;
  }
  return null;
}

/* ---- part 1 · order: reformulated points in true text order ---- */

export async function generateOrder(doc) {
  const sources = spreadSentences(doc);
  if (sources.length < 2) {
    throw new Error("Text is too short for the order part");
  }
  const points = sources;
  try {
    const provider = await siteModelProvider();
    const reformulated = await Promise.all(
      sources.map(async (sentence) => {
        const prompt = reformulatePrompt(sentence, doc.language);
        const raw = await chatCall(
          provider,
          prompt.system,
          prompt.user,
          GENERATE_TIMEOUT_MS,
          300,
        ).catch(() => null);
        const cleaned = raw === null ? null : cleanReformulation(raw);
        return cleaned && usableReformulation(sentence, cleaned) ? cleaned : null;
      }),
    );
    if (reformulated.some(Boolean)) {
      return {
        part: "order",
        source: provider.model,
        created: nowCreated(),
        points: reformulated.map((point, index) => point ?? sources[index]),
      };
    }
  } catch (error) {
    console.error(`order generation failed: ${error.message}`);
  }
  return {
    part: "order",
    source: "deterministic",
    created: nowCreated(),
    points,
  };
}

/* ---- part 2 · events: true facts from the text + invented ones ---- */

export async function generateEvents(doc) {
  try {
    const provider = await siteModelProvider();
    // two plain-text requests: 6 facts from the text, 6 invented facts
    const facts = await fetchFacts(
      provider,
      docText(doc),
      doc.language,
      GENERATE_TIMEOUT_MS,
    );
    if (!facts.true.length || !facts.false.length) {
      throw new Error("Model did not provide usable facts");
    }
    const parsed = validateEvents(facts);
    const corpus = foldKey(docText(doc));
    if (parsed.false.length >= 2) {
      parsed.false = notFromText(parsed.false, corpus);
    }
    if (parsed.false.length < 2) {
      throw new Error("Every invented fact was taken from the text itself");
    }
    return {
      part: "events",
      source: provider.model,
      created: nowCreated(),
      ...parsed,
    };
  } catch (error) {
    console.error(`events generation failed: ${error.message}`);
    // offline fallback: true sentences from the text, false ones recombined
    const sentences = docSentences(doc).slice(0, 8);
    const taken = new Set(sentences.map((sentence) => sentence.toLowerCase()));
    const falsy = [];
    for (let i = 0; i < sentences.length && falsy.length < 6; i++) {
      for (const other of sentences) {
        if (other === sentences[i]) {
          continue;
        }
        const wrong = recombined(sentences[i], other, taken);
        if (wrong) {
          taken.add(wrong.toLowerCase());
          falsy.push(wrong);
          break;
        }
      }
    }
    if (sentences.length < 2 || falsy.length < 2) {
      throw new Error(error.message);
    }
    return {
      part: "events",
      source: "deterministic",
      created: nowCreated(),
      true: sentences,
      false: falsy,
    };
  }
}

/* ---- part 3 · questions: multiple-choice questions about the text ---- */

export async function generateQuestions(doc) {
  if (docSentences(doc).length < 2) {
    throw new Error("Text is too short for the questions part");
  }
  try {
    const provider = await siteModelProvider();
    const prompt = questionsPrompt(docText(doc), doc.language);
    const raw = await chatCall(
      provider,
      prompt.system,
      prompt.user,
      GENERATE_TIMEOUT_MS,
      1500,
    );
    const parsed = tryJson(raw);
    if (!parsed) {
      throw new Error("No JSON object found");
    }
    const { questions } = validateQuestions(parsed);
    return {
      part: "questions",
      source: provider.model,
      created: nowCreated(),
      items: questions,
    };
  } catch (error) {
    console.error(`questions generation failed: ${error.message}`);
  }
  return {
    part: "questions",
    source: "deterministic",
    created: nowCreated(),
    items: blankQuestions(doc, 4),
  };
}

/* Deterministic fallback: blank a bare content word in the sentence, four
   choices — the word itself plus bare words from other sentences of the
   text. */
function blankQuestions(doc, limit) {
  const sentences = spreadSentences(doc, limit);
  const bare = (token) => /^[\p{L}][\p{L}\p{N}'’-]*$/u.test(token);
  const pool = [];
  for (const other of docSentences(doc)) {
    pool.push(...other.split(/\s+/).filter((token) => bare(token)));
  }
  const items = [];
  for (const sentence of sentences) {
    const tokens = sentence.split(/\s+/);
    let at = -1;
    for (let i = 1; i < tokens.length; i++) {
      if (bare(tokens[i]) && (at === -1 || tokens[i].length > tokens[at].length)) {
        at = i;
      }
    }
    const word = at === -1 ? "" : tokens[at];
    if (word.length < 3) {
      continue;
    }
    const choices = [word];
    for (const candidate of pool) {
      if (choices.length >= 4) {
        break;
      }
      const key = foldKey(candidate);
      if (!key || choices.some((choice) => foldKey(choice) === key)) {
        continue;
      }
      choices.push(candidate);
    }
    if (choices.length < 4) {
      continue;
    }
    const options = choices.map((text, i) => ({ text, correct: i === 0 }));
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    const question = [...tokens];
    question[at] = "___";
    items.push({
      question: question.join(" "),
      choices: options.map((option) => option.text),
      answer: options.findIndex((option) => option.correct),
    });
  }
  if (items.length < 2) {
    throw new Error("Not enough bare words in the text for the questions part");
  }
  return items;
}

/* ---- part 4 · arrange: sentences split into scrambled words ---- */

export async function generateArrangement(doc) {
  const sentences = spreadSentences(doc, 5);
  if (sentences.length < 2) {
    throw new Error("Text is too short for the arrange part");
  }
  try {
    const provider = await siteModelProvider();
    const prompt = translateLinesPrompt(sentences, doc.language, doc.translate_to);
    const raw = await chatCall(
      provider,
      prompt.system,
      prompt.user,
      GENERATE_TIMEOUT_MS,
      1500,
    );
    const parsed = tryJson(raw);
    if (!parsed) {
      throw new Error("No JSON object found");
    }
    const { translations } = validateTranslations(parsed, sentences.length);
    return {
      part: "arrange",
      source: provider.model,
      created: nowCreated(),
      items: sentences.map((sentence, i) => ({
        sentence,
        translation: translations[i] || "",
      })),
    };
  } catch (error) {
    console.error(`arrange generation failed: ${error.message}`);
    // offline fallback: original sentences, the pages simply show no translations
  }
  return {
    part: "arrange",
    source: "deterministic",
    created: nowCreated(),
    items: sentences.map((sentence) => ({ sentence, translation: "" })),
  };
}

const GENERATORS = {
  order: generateOrder,
  events: generateEvents,
  questions: generateQuestions,
  arrange: generateArrangement,
};

/* ---- background build task ---- */

/* One record per running/errored build: the browser polls progress, so a
   reload does not re-run what the json already holds. */
const tasks = new Map();

/* (Re)start the asynchronous build for a document: stages already stored
   are skipped, the rest run one by one, each stored as soon as it is
   ready. Returns the current progress so the caller paints at once. */
export async function startBuild(id) {
  const doc = loadParsedDoc(id);
  if (doc === null) {
    return null;
  }
  const running = tasks.get(id);
  if (running?.state === "building") {
    return testProgress(id);
  }
  if (STAGES.every((stage) => partDone(doc.test, stage.key))) {
    tasks.delete(id);
    return testProgress(id);
  }
  const task = { state: "building", error: "" };
  tasks.set(id, task);
  run(task, id);
  return testProgress(id);
}

function run(task, id) {
  void (async () => {
    for (const stage of STAGES) {
      const doc = loadParsedDoc(id);
      if (doc === null) {
        // document deleted while building
        break;
      }
      if (partDone(doc.test, stage.key)) {
        continue;
      }
      try {
        const entry = await GENERATORS[stage.key](doc);
        storeEntry(id, doc, stage.key, entry);
      } catch (error) {
        task.state = "error";
        task.error = error.message;
        break;
      }
    }
    if (task.state === "building") {
      task.state = "done";
    }
    // the record stays: an errored build must remain visible to the poller
    // (a fresh POST /api/test/build replaces it and re-runs what is missing)
  })();
}

/* What the progress bar paints: per-part readiness (with the fallback
   flag), the overall state, and the error while a build has failed. */
export function testProgress(id) {
  const doc = loadParsedDoc(id);
  if (doc === null) {
    return null;
  }
  const stages = STAGES.map((stage) => ({
    key: stage.key,
    label: stage.label,
    done: partDone(doc.test, stage.key),
    fallback: doc.test?.[stage.key]?.source === "deterministic",
  }));
  const done = stages.filter((stage) => stage.done).length;
  const task = tasks.get(id);
  return {
    state:
      done === STAGES.length
        ? "done"
        : task?.state === "error"
          ? "error"
          : "building",
    error: task?.error || "",
    done,
    total: STAGES.length,
    stages,
  };
}
