import { error, redirect } from "@sveltejs/kit";
import { loadDoc } from "$lib/server/storage.js";

/* The review screen shows the generated test as it is stored; a part can
   be regenerated right from here. */
export async function load({ params }) {
  const raw = loadDoc(params.id);
  if (raw === null) {
    error(404, "Document not found");
  }
  const doc = JSON.parse(raw);
  const order = doc.test?.order ?? null;
  const events = doc.test?.events ?? null;
  if (!order?.points?.length && !events?.true?.length) {
    // the test is built during document processing
    redirect(302, `/process/${params.id}`);
  }
  return { id: params.id, title: doc.title || "Untitled", order, events };
}
