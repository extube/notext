import { error, redirect } from "@sveltejs/kit";
import { loadDoc } from "$lib/server/storage.js";

export async function GET({ params }) {
  if (loadDoc(params.id) === null) {
    error(404, "Document not found");
  }
  redirect(302, `/doc/${params.id}/view`);
}
