import { error } from "@sveltejs/kit";
import { loadDoc } from "$lib/server/storage.js";
import { docText, spreadSentences } from "$lib/server/testpart.js";

/* The doc text (parsed json) already exists when this page opens; the
   async build task reads it again from the json. This load only has to
   provide the upgrade material for deterministic parts repaired by the
   user's own LLM in this browser. */
export async function load({ params }) {
  const raw = loadDoc(params.id);
  if (raw === null) {
    error(404, "Document not found");
  }
  const doc = JSON.parse(raw);
  return {
    id: params.id,
    title: doc.title || "Untitled",
    language: doc.language,
    upgrades: {
      text: docText(doc),
      sentences: spreadSentences(doc),
    },
  };
}
