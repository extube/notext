import { listDocs } from "$lib/server/storage.js";
import { tileHue } from "$lib/server/tiles.js";

/* The main menu holds only the first 16 texts, the rest live on /list. */
function hueDocs(docs) {
  return docs.map((doc) => ({ ...doc, hue: tileHue(doc.title, doc.date, doc.language) }));
}

export function load() {
  const all = listDocs();
  return { docs: hueDocs(all.slice(0, 16)), total: all.length };
}
