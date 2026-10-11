import { json } from "@sveltejs/kit";
import {
  docSentences,
  docText,
  generateWithSite,
  loadParsedDoc,
  nowCreated,
  readRequest,
  storeEntry,
} from "$lib/server/testpart.js";
import {
  eventsPrompt,
  parseLooseJson,
  salvageJsonText,
  validateEvents,
} from "$lib/llm.js";

/* Deterministic false sentences: take a real sentence and swap two words
   near the start — same topic, detail changed, never a verbatim repeat. */
function corrupted(sentence, notThese) {
  const words = sentence.split(/\s+/);
  if (words.length < 4) {
    return null;
  }
  const other = words[1];
  words[1] = words[2];
  words[2] = other;
  const wrong = words.join(" ");
  if (notThese.has(wrong.toLowerCase())) {
    return null;
  }
  return wrong;
}

export async function POST({ request, url }) {
  const { body, id, regenerate } = await readRequest(request, url);
  const doc = loadParsedDoc(id);
  if (doc === null) {
    return json({ error: "Document not found" }, { status: 404 });
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
    const { raw, model } = await generateWithSite(text, eventsPrompt(text, doc.translate_to || doc.language));
    let parsed;
    try {
      parsed = validateEvents(parseLooseJson(raw));
    } catch {
      const salvaged = salvageJsonText(raw);
      if (!salvaged) {
        throw new Error("Unparseable events reply");
      }
      parsed = validateEvents(parseLooseJson(salvaged));
    }
    entry = {
      part: "events",
      source: model,
      created: nowCreated(),
      ...parsed,
    };
  } catch (error) {
    console.error(`events generation failed: ${error.message}`);
    // offline fallback: true sentences from the text, false ones corrupted
    const sentences = docSentences(doc).slice(0, 6);
    const taken = new Set(sentences.map((sentence) => sentence.toLowerCase()));
    const falsy = [];
    for (const sentence of sentences) {
      const wrong = corrupted(sentence, taken);
      if (wrong) {
        taken.add(wrong.toLowerCase());
        falsy.push(wrong);
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
