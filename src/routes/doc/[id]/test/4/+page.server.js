import { error, redirect } from "@sveltejs/kit";
import { loadDoc } from "$lib/server/storage.js";

/* The one-time build lives on the process page: this part must be stored
   before the page can open — otherwise send the reader there. */
export async function load({ params }) {
  const raw = loadDoc(params.id);
  if (raw === null) {
    error(404, "Document not found");
  }
  const doc = JSON.parse(raw);
  const entry = doc.test?.arrange;
  if (!entry?.items?.length) {
    redirect(302, `/process/${params.id}`);
  }
  return {
    id: params.id,
    title: doc.title || "Untitled",
    entry,
  };
}
