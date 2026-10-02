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

export function loadLink(linkId) {
  if (!ID_RE.test(linkId)) return null;
  try {
    return fs.readFileSync(path.join(LINKS_DIR, linkId), "utf8");
  } catch {
    return null;
  }
}
