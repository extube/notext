import { listDocs } from "$lib/server/storage.js";
import { tileHue } from "$lib/server/tiles.js";

/* All stored texts, 24 per page. */
export function load({ url }) {
  const all = listDocs();
  const pages = Math.max(1, Math.ceil(all.length / 24));
  const page = Math.min(pages, Math.max(1, Number(url.searchParams.get("page")) || 1));
  const docs = all
    .slice((page - 1) * 24, page * 24)
    .map((doc) => ({ ...doc, hue: tileHue(doc.title, doc.date, doc.language) }));
  return { docs, page, pages };
}
