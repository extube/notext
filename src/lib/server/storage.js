import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DATA_DIR = path.resolve("data");
const LINKS_DIR = path.join(DATA_DIR, "links");
const ID_RE = /^[A-Za-z0-9_-]+$/;

export function saveDoc(doc) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const id = Buffer.from(crypto.randomUUID()).toString("base64url");
  fs.writeFileSync(path.join(DATA_DIR, `${id}.json`), JSON.stringify(doc, null, 2));
  return id;
}

export function loadDoc(id) {
  if (!ID_RE.test(id)) return null;
  try {
    return fs.readFileSync(path.join(DATA_DIR, `${id}.json`), "utf8");
  } catch {
    return null;
  }
}

/* Shallow-merge top-level fields into an existing document. */
export function patchDoc(id, patch) {
  const raw = loadDoc(id);
  if (raw === null) {
    return null;
  }
  const doc = JSON.parse(raw);
  Object.assign(doc, patch);
  fs.writeFileSync(path.join(DATA_DIR, `${id}.json`), JSON.stringify(doc, null, 2));
  return doc;
}

export function findOrCreateLink(docId) {
  fs.mkdirSync(LINKS_DIR, { recursive: true });
  for (const entry of fs.readdirSync(LINKS_DIR)) {
    try {
      if (fs.readFileSync(path.join(LINKS_DIR, entry), "utf8") === docId) return entry;
    } catch {
      // skip unreadable link files
    }
  }
  const linkId = Buffer.from(crypto.randomUUID()).toString("base64url");
  fs.writeFileSync(path.join(LINKS_DIR, linkId), docId);
  return linkId;
}

export function deleteDoc(id) {
  if (!ID_RE.test(id)) return false;
  try {
    fs.unlinkSync(path.join(DATA_DIR, `${id}.json`));
  } catch {
    return false;
  }
  // a deleted doc takes its share links with it
  for (const linkId of linkedIds(id)) {
    try {
      fs.unlinkSync(path.join(LINKS_DIR, linkId));
    } catch {
      // already gone
    }
  }
  return true;
}

function linkedIds(docId) {
  try {
    return fs
      .readdirSync(LINKS_DIR)
      .filter((entry) => {
        try {
          return fs.readFileSync(path.join(LINKS_DIR, entry), "utf8") === docId;
        } catch {
          return false;
        }
      });
  } catch {
    return [];
  }
}

export function loadLink(linkId) {
  if (!ID_RE.test(linkId)) return null;
  try {
    return fs.readFileSync(path.join(LINKS_DIR, linkId), "utf8");
  } catch {
    return null;
  }
}

/* Everything stored so far, newest first: title, origin language and a
   summary percent across solved test parts (null while unsolved). */
export function listDocs() {
  let entries;
  try {
    entries = fs.readdirSync(DATA_DIR);
  } catch {
    return [];
  }
  const docs = [];
  for (const entry of entries) {
    if (!entry.endsWith(".json") || !ID_RE.test(entry.slice(0, -5))) continue;
    const id = entry.slice(0, -5);
    try {
      const doc = JSON.parse(fs.readFileSync(path.join(DATA_DIR, entry), "utf8"));
      const test = doc.test || {};
      const percents = [test.order, test.events]
        .map((part) =>
          part?.score && part.score.total
            ? (100 * part.score.correct) / part.score.total
            : null,
        )
        .filter((percent) => typeof percent === "number");
      docs.push({
        id,
        title: doc.title || "Untitled",
        date: doc.date || "",
        language: doc.language || "",
        score: percents.length
          ? Math.round(percents.reduce((sum, p) => sum + p, 0) / percents.length)
          : null,
      });
    } catch {
      // skip unreadable documents
    }
  }
  docs.sort(
    (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.title.localeCompare(b.title)),
  );
  return docs;
}
