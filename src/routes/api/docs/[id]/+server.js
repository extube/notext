import { error, json } from "@sveltejs/kit";
import { deleteDoc, loadDoc } from "$lib/server/storage.js";

export async function GET({ params }) {
  const raw = loadDoc(params.id);
  if (raw === null) {
    error(404, "Document not found");
  }
  return new Response(raw, {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export async function DELETE({ params }) {
  if (!deleteDoc(params.id)) {
    error(404, "Document not found");
  }
  return json({ deleted: true });
}
