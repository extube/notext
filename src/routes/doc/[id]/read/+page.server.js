import { error } from "@sveltejs/kit";
import { loadDoc } from "$lib/server/storage.js";
import { normalizeDocUnits } from "$lib/server/parser.js";

export async function load({ params }) {
  const raw = loadDoc(params.id);
  if (raw === null) {
    error(404, "Document not found");
  }
  return { id: params.id, doc: normalizeDocUnits(JSON.parse(raw)) };
}
