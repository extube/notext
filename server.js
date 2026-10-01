import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { parseText } from "./js/parser.js";
import { formPage, viewPage, readPage, jsonPage, sharePage, testPage, testResultPage, notFoundPage } from "./js/pages.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(ROOT, "data");
const LINKS_DIR = path.join(DATA_DIR, "links");
const PORT = process.env.PORT || 3000;
const MAX_BODY = 10 * 1024 * 1024;
const ID_RE = /^[A-Za-z0-9_-]+$/;

const MIME = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function send(res, code, body, type = "text/html; charset=utf-8") {
  res.writeHead(code, { "Content-Type": type });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function parseMultipart(buf, boundary) {
  const parts = [];
  const delim = Buffer.from(`--${boundary}`);
  let start = buf.indexOf(delim);
  while (start !== -1) {
    const next = buf.indexOf(delim, start + delim.length);
    if (next === -1) break;
    let segStart = start + delim.length;
    if (buf.slice(segStart, segStart + 2).toString() === "\r\n") segStart += 2;
    const segment = buf.slice(segStart, next - 2);
    const headerEnd = segment.indexOf("\r\n\r\n");
    if (headerEnd !== -1) {
      const header = segment.slice(0, headerEnd).toString("utf8");
      const nameMatch = header.match(/name="([^"]*)"/);
      const fileMatch = header.match(/filename="([^"]*)"/);
      parts.push({
        name: nameMatch ? nameMatch[1] : "",
        filename: fileMatch ? fileMatch[1] : null,
        data: segment.slice(headerEnd + 4),
      });
    }
    start = next;
  }
  return parts;
}

function saveDoc(doc) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const id = Buffer.from(crypto.randomUUID()).toString("base64url");
  fs.writeFileSync(path.join(DATA_DIR, `${id}.json`), JSON.stringify(doc, null, 2));
  return id;
}

function loadDoc(id) {
  if (!ID_RE.test(id)) return null;
  try {
    return fs.readFileSync(path.join(DATA_DIR, `${id}.json`), "utf8");
  } catch {
    return null;
  }
}

async function handleRead(req, res) {
  const contentType = req.headers["content-type"] || "";
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
  if (!contentType.includes("multipart/form-data") || !boundaryMatch) {
    send(res, 400, formPage({}, "Invalid form submission."));
    return;
  }

  const fields = {};
  let file = null;
  for (const part of parseMultipart(await readBody(req), boundaryMatch[1] || boundaryMatch[2])) {
    if (part.filename !== null) {
      if (part.filename) file = { name: part.filename, data: part.data };
    } else {
      fields[part.name] = part.data.toString("utf8");
    }
  }

  let text = (fields.text || "").trim();
  if (file) {
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".txt") && !lower.endsWith(".md")) {
      send(res, 400, formPage(fields, "Unsupported file format. Use .txt or .md."));
      return;
    }
    text = file.data.toString("utf8").trim();
  }

  if (!text) {
    send(res, 400, formPage(fields, "Provide text or upload a file."));
    return;
  }
  if (!fields.language) {
    send(res, 400, formPage(fields, "Select the text language."));
    return;
  }

  const doc = parseText(text, {
    title: (fields.title || "").trim() || "Untitled",
    date: fields.date || "",
    language: fields.language,
    translate_to: fields.translate_to || "",
  });

  const id = saveDoc(doc);
  res.writeHead(303, { Location: `/doc/${id}/view` });
  res.end();
}

function findOrCreateLink(docId) {
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

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");

  try {
    if (req.method === "GET" && pathname === "/") {
      send(res, 200, formPage({}));
      return;
    }

    if (req.method === "POST" && pathname === "/read") {
      await handleRead(req, res);
      return;
    }

    let     m = pathname.match(/^\/doc\/([A-Za-z0-9_-]+)$/);
    if (req.method === "GET" && m) {
      if (loadDoc(m[1]) === null) {
        send(res, 404, notFoundPage());
      } else {
        res.writeHead(302, { Location: `/doc/${m[1]}/view` });
        res.end();
      }
      return;
    }

    m = pathname.match(/^\/doc\/([A-Za-z0-9_-]+)\/(view|read|json|share|test|test\/result)$/);
    if (req.method === "GET" && m) {
      const [, id, action] = m;
      const raw = loadDoc(id);
      if (raw === null) {
        send(res, 404, notFoundPage());
      } else if (action === "view") {
        send(res, 200, viewPage(id, JSON.parse(raw)));
      } else if (action === "read") {
        send(res, 200, readPage(id, JSON.parse(raw)));
      } else if (action === "json") {
        send(res, 200, jsonPage(id, raw));
      } else if (action === "test") {
        send(res, 200, testPage(id, JSON.parse(raw)));
      } else if (action === "test/result") {
        send(res, 200, testResultPage(id, JSON.parse(raw)));
      } else {
        const linkId = findOrCreateLink(id);
        const host = req.headers.host || "localhost";
        send(res, 200, sharePage(id, `http://${host}/link/${linkId}`));
      }
      return;
    }

    m = pathname.match(/^\/link\/([A-Za-z0-9_-]+)$/);
    if (req.method === "GET" && m) {
      const linkId = m[1];
      let docId = null;
      if (ID_RE.test(linkId)) {
        try {
          docId = fs.readFileSync(path.join(LINKS_DIR, linkId), "utf8");
        } catch {
          docId = null;
        }
      }
      if (docId && loadDoc(docId) !== null) {
        res.writeHead(302, { Location: `/doc/${docId}/view` });
        res.end();
      } else {
        send(res, 404, notFoundPage());
      }
      return;
    }

    m = pathname.match(/^\/api\/docs\/([A-Za-z0-9_-]+)$/);
    if (req.method === "GET" && m) {
      const raw = loadDoc(m[1]);
      if (raw === null) {
        send(res, 404, "document not found", "text/plain; charset=utf-8");
      } else {
        send(res, 200, raw, "application/json; charset=utf-8");
      }
      return;
    }

    const filePath = path.normalize(path.join(ROOT, pathname));
    if (req.method === "GET" && filePath.startsWith(ROOT) && MIME[path.extname(filePath)]) {
      fs.readFile(filePath, (err, data) => {
        if (err) {
          send(res, 404, notFoundPage());
          return;
        }
        send(res, 200, data, MIME[path.extname(filePath)]);
      });
      return;
    }

    send(res, 404, notFoundPage());
  } catch {
    send(res, 500, "500 Internal Server Error", "text/plain; charset=utf-8");
  }
});

server.listen(PORT, () => {
  console.log(`notext is running at http://localhost:${PORT}`);
});
