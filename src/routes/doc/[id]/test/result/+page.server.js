import { error } from "@sveltejs/kit";
import { loadDoc } from "$lib/server/storage.js";

export async function load({ params }) {
  const raw = loadDoc(params.id);
  if (raw === null) {
    error(404, "Document not found");
  }
  const doc = JSON.parse(raw);
  const test = doc.test || {};
  return {
    id: params.id,
    doc,
    parts: [
      {
        key: "order",
        title: "Part 1 · Order",
        score: test.order?.points?.length ? test.order.score ?? null : null,
      },
      {
        key: "events",
        title: "Part 2 · Events",
        score: test.events?.true?.length && test.events?.false?.length
          ? test.events.score ?? null
          : null,
      },
      {
        key: "questions",
        title: "Part 3 · Questions",
        score: test.questions?.items?.length ? test.questions.score ?? null : null,
      },
      {
        key: "arrange",
        title: "Part 4 · Arrange",
        score: test.arrange?.items?.length ? test.arrange.score ?? null : null,
      },
    ],
  };
}
