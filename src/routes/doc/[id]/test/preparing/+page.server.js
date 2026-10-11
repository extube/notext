import { error, redirect } from "@sveltejs/kit";
import { loadDoc } from "$lib/server/storage.js";

/* An already built test json opens straight away: preparing then has
   nothing left to do and the journey starts at part 1. */
export async function load({ params }) {
  const raw = loadDoc(params.id);
  if (raw === null) {
    error(404, "Document not found");
  }
  const doc = JSON.parse(raw);
  const test = doc.test || {};
  if (
    test.order?.points?.length &&
    test.events?.true?.length &&
    test.events?.false?.length
  ) {
    redirect(302, `/doc/${params.id}/test/1`);
  }
  return {
    id: params.id,
    title: doc.title || "Untitled",
    to: doc.translate_to || doc.language,
  };
}
