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
  const test = doc.test || {};
  const order = test.order ?? null;
  const events = test.events ?? null;
  const questions = test.questions ?? null;
  const arrange = test.arrange ?? null;
  if (
    !(order?.points?.length || events?.true?.length ||
      questions?.items?.length || arrange?.items?.length)
  ) {
    // the test is built during document processing
    redirect(302, `/process/${params.id}`);
  }
  return { id: params.id, title: doc.title || "Untitled", order, events, questions, arrange };
}
