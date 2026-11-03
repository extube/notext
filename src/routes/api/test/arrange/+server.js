import { json } from "@sveltejs/kit";
import {
  loadParsedDoc,
  nowCreated,
  readRequest,
  readScore,
  storeEntry,
} from "$lib/server/testpart.js";
import { generateArrangement } from "$lib/server/testgen.js";

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
      const existing_ = doc.test?.arrange;
      if (existing_?.items?.length) {
        const entry = { ...existing_, score };
        storeEntry(id, doc, "arrange", entry);
        return json(entry);
      }
      return json({ error: "Part not built yet" }, { status: 400 });
    }
  } catch (error) {
    return json({ error: error.message }, { status: 400 });
  }

  // already generated? open again → load the stored json
  const existing = doc.test?.arrange;
  if (existing?.items?.length && !regenerate) {
    return json(existing);
  }

  try {
    const entry = await generateArrangement(doc);
    storeEntry(id, doc, "arrange", entry);
    return json({
      ...entry,
      fallback: entry.source === "deterministic",
    });
  } catch (error) {
    return json({ error: `Arrange generation failed: ${error.message}` }, { status: 500 });
  }
}
