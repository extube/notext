import { error, redirect } from "@sveltejs/kit";
import { loadDoc } from "$lib/server/storage.js";

/* The doc text (parsed json) already exists when this page opens; the
   checklist only has to finish the test parts. */
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
  };
}
