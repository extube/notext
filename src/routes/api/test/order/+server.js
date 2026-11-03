import { json } from "@sveltejs/kit";
import {
  docText,
  loadParsedDoc,
  nowCreated,
  readRequest,
  readScore,
  spreadSentences,
  storeEntry,
} from "$lib/server/testpart.js";
import { generateOrder } from "$lib/server/testgen.js";
import { validatePoints } from "$lib/llm.js";

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
      const existing_ = doc.test?.order;
      if (existing_?.points) {
        const entry = { ...existing_, score };
        storeEntry(id, doc, "order", entry);
        return json(entry);
      }
      return json({ error: "Part not built yet" }, { status: 400 });
    }
  } catch (error) {
    return json({ error: error.message }, { status: 400 });
  }

  // reformulated points generated in this browser through the user's LLM
  if (body?.order?.points) {
    try {
      const points = validatePoints(body.order).points;
      const entry = {
        part: "order",
        source: "user-llm",
        created: nowCreated(),
        points,
      };
      storeEntry(id, doc, "order", entry);
      return json(entry);
    } catch (error) {
      return json({ error: `Invalid points: ${error.message}` }, { status: 400 });
    }
  }

  // already generated? open again → load the stored json
  const existing = doc.test?.order;
  if (existing?.points?.length && !regenerate) {
    return json(existing);
  }

  try {
    const entry = await generateOrder(doc);
    storeEntry(id, doc, "order", entry);
    return json({
      ...entry,
      fallback: entry.source === "deterministic",
      text: docText(doc),
      sentences: spreadSentences(doc),
    });
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
}
