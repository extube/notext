import { json } from "@sveltejs/kit";
import {
  loadParsedDoc,
  nowCreated,
  readRequest,
  readScore,
  storeEntry,
} from "$lib/server/testpart.js";
import { generateQuestions } from "$lib/server/testgen.js";
import { validateQuestions } from "$lib/llm.js";

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
      const existing_ = doc.test?.questions;
      if (existing_?.items?.length) {
        const entry = { ...existing_, score };
        storeEntry(id, doc, "questions", entry);
        return json(entry);
      }
      return json({ error: "Part not built yet" }, { status: 400 });
    }
  } catch (error) {
    return json({ error: error.message }, { status: 400 });
  }

  // questions generated in this browser through the user's own LLM
  if (body?.questions) {
    try {
      const { questions } = validateQuestions(body.questions);
      const entry = {
        part: "questions",
        source: "user-llm",
        created: nowCreated(),
        items: questions,
      };
      storeEntry(id, doc, "questions", entry);
      return json(entry);
    } catch (error) {
      return json({ error: `Invalid questions: ${error.message}` }, { status: 400 });
    }
  }

  // already generated? open again → load the stored json
  const existing = doc.test?.questions;
  if (existing?.items?.length && !regenerate) {
    return json(existing);
  }

  try {
    const entry = await generateQuestions(doc);
    storeEntry(id, doc, "questions", entry);
    return json({
      ...entry,
      fallback: entry.source === "deterministic",
    });
  } catch (error) {
    return json({ error: `Questions generation failed: ${error.message}` }, { status: 500 });
  }
}
