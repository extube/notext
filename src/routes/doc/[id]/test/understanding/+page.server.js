import { error } from "@sveltejs/kit";
import { loadDoc } from "$lib/server/storage.js";

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
    to: doc.translate_to || doc.language,
    quiz: doc.test?.understanding ?? null,
  };
}
