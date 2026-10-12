import { json } from "@sveltejs/kit";
import {
  GENERATE_TIMEOUT_MS,
  docText,
  loadParsedDoc,
  nowCreated,
  readRequest,
  readScore,
  siteModelProvider,
  spreadSentences,
  storeEntry,
} from "$lib/server/testpart.js";
import {
  chatCall,
  cleanReformulation,
  reformulatePrompt,
  usableReformulation,
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

  let entry;
  // 6 sentences picked programmatically across the text, in text order;
  // each one goes through its own "rephrase it" request
  const sources = spreadSentences(doc);
  if (sources.length < 2) {
    return json({ error: "Text is too short for the order part" }, { status: 500 });
  }
  let points = sources;
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
      points = reformulated.map((point, index) => point ?? sources[index]);
      entry = {
        part: "order",
        source: provider.model,
        created: nowCreated(),
        points,
      };
    } else {
      // no usable reformulation: original sentences, still in true order
      entry = {
        part: "order",
        source: "deterministic",
        created: nowCreated(),
        points,
      };
    }
  } catch (error) {
    console.error(`order generation failed: ${error.message}`);
    entry = {
      part: "order",
      source: "deterministic",
      created: nowCreated(),
      points,
    };
  }
  storeEntry(id, doc, "order", entry);
  return json({
    ...entry,
    fallback: entry.source === "deterministic",
    text: docText(doc),
    sentences: sources,
  });
}
