import { json } from "@sveltejs/kit";
import {
  docSentences,
  docText,
  generateWithSite,
  loadParsedDoc,
  nowCreated,
  readRequest,
  readScore,
  storeEntry,
} from "$lib/server/testpart.js";
import {
  parseLooseJson,
  orderPrompt,
  salvageJsonText,
  validatePoints,
} from "$lib/llm.js";

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

  // points generated in this browser through the user's own LLM
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

  const text = docText(doc);
  let entry;
  try {
    const { raw, model } = await generateWithSite(text, orderPrompt(text, doc.translate_to || doc.language));
    let parsed;
    try {
      parsed = validatePoints(parseLooseJson(raw));
    } catch {
      const salvaged = salvageJsonText(raw);
      if (!salvaged) {
        throw new Error("Unparseable points reply");
      }
      parsed = validatePoints(parseLooseJson(salvaged));
    }
    entry = {
      part: "order",
      source: model,
      created: nowCreated(),
      points: parsed.points,
    };
  } catch (error) {
    console.error(`order generation failed: ${error.message}`);
    // offline fallback: the first sentences in text order are the points
    let points = docSentences(doc).slice(0, 6);
    if (points.length < 2) {
      return json({ error: `Order generation failed: ${error.message}` }, { status: 500 });
    }
    entry = {
      part: "order",
      source: "deterministic",
      created: nowCreated(),
      points,
    };
  }
  storeEntry(id, doc, "order", entry);
  return json({ ...entry, fallback: entry.source === "deterministic", text });
}
