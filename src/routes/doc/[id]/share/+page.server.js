import { error } from "@sveltejs/kit";
import { findOrCreateLink, loadDoc } from "$lib/server/storage.js";

export async function load({ params, url }) {
  const raw = loadDoc(params.id);
  if (raw === null) {
    error(404, "Document not found");
  }
  const linkId = findOrCreateLink(params.id);
  return { id: params.id, url: `${url.origin}/link/${linkId}` };
}
