import { json } from "@sveltejs/kit";
import {
  GENERATE_TIMEOUT_MS,
  docSentences,
  docText,
  loadParsedDoc,
  nowCreated,
  readRequest,
  readScore,
  siteModelProvider,
  storeEntry,
} from "$lib/server/testpart.js";
import { fetchFacts, validateEvents } from "$lib/llm.js";

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

export async function POST({ request, url }) {
  const { body, id, regenerate } = await readRequest(request, url);
  const doc = loadParsedDoc(id);
  if (doc === null) {
    return json({ error: "Document not found" }, { status: 404 });
  }

  // solved-round score from the browser (statistics for the result page)
  try {
    const score = readScore(body);
    if (score) {
      const existing_ = doc.test?.events;
      if (existing_?.true?.length && existing_?.false?.length) {
        const entry = { ...existing_, score };
        storeEntry(id, doc, "events", entry);
        return json(entry);
      }
      return json({ error: "Part not built yet" }, { status: 400 });
    }
  } catch (error) {
    return json({ error: error.message }, { status: 400 });
  }

  // sentences generated in this browser through the user's own LLM
  if (body?.events) {
    try {
      const events = validateEvents(body.events);
      const entry = {
        part: "events",
        source: "user-llm",
        created: nowCreated(),
        ...events,
      };
      storeEntry(id, doc, "events", entry);
      return json(entry);
    } catch (error) {
      return json({ error: `Invalid events: ${error.message}` }, { status: 400 });
    }
  }

  // already generated? open again → load the stored json
  const existing = doc.test?.events;
  if (existing?.true?.length && existing?.false?.length && !regenerate) {
    return json(existing);
  }

  const text = docText(doc);
  let entry;
  try {
    // two plain-text requests: 6 facts from the text, 6 invented facts
    const provider = await siteModelProvider();
    const facts = await fetchFacts(
      provider,
      text,
      doc.translate_to || doc.language,
      GENERATE_TIMEOUT_MS,
    );
    if (!facts.true.length || !facts.false.length) {
      throw new Error("Model did not provide usable facts");
    }
    const parsed = validateEvents(facts);
    entry = {
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
      if (falsy.length >= 6) {
        break;
      }
    }
    if (sentences.length < 2 || falsy.length < 2) {
      return json({ error: `Events generation failed: ${error.message}` }, { status: 500 });
    }
    entry = {
      part: "events",
      source: "deterministic",
      created: nowCreated(),
      true: sentences,
      false: falsy,
    };
  }
  storeEntry(id, doc, "events", entry);
  return json({ ...entry, fallback: entry.source === "deterministic", text });
}
