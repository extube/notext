import { error, redirect } from "@sveltejs/kit";
import { loadDoc, loadLink } from "$lib/server/storage.js";

export async function GET({ params }) {
  const docId = loadLink(params.link_id);
  if (docId === null || loadDoc(docId) === null) {
    error(404, "Link not found");
  }
  redirect(302, `/doc/${docId}/view`);
}
