import { json } from "@sveltejs/kit";
import { testProgress } from "$lib/server/testgen.js";

export async function GET({ url }) {
  const progress = testProgress(url.searchParams.get("id") || "");
  if (progress === null) {
    return json({ error: "Document not found" }, { status: 404 });
  }
  return json(progress);
}
