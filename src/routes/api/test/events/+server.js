import { json } from "@sveltejs/kit";
import {
  docText,
  loadParsedDoc,
  nowCreated,
  readRequest,
  readScore,
  storeEntry,
} from "$lib/server/testpart.js";
import { generateEvents, notFromText } from "$lib/server/testgen.js";
import { foldKey, validateEvents } from "$lib/llm.js";

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
      events.false = notFromText(events.false, foldKey(docText(doc)));
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

  try {
    const entry = await generateEvents(doc);
    storeEntry(id, doc, "events", entry);
    return json({
      ...entry,
      fallback: entry.source === "deterministic",
      text: docText(doc),
    });
  } catch (error) {
    return json({ error: `Events generation failed: ${error.message}` }, { status: 500 });
  }
}
