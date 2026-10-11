import { error, redirect } from "@sveltejs/kit";
import { loadDoc } from "$lib/server/storage.js";

/* The one-time setup lives on the test menu: both parts must be stored
   before this page can open — otherwise send the reader back there. */
export async function load({ params }) {
  const raw = loadDoc(params.id);
  if (raw === null) {
    error(404, "Document not found");
  }
  const doc = JSON.parse(raw);
  const entry = doc.test?.events;
  if (!entry?.true?.length || !entry?.false?.length) {
    redirect(302, `/doc/${params.id}/test`);
  }
  return {
    id: params.id,
    title: doc.title || "Untitled",
    entry,
  };
}
