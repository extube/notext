import { fail, redirect } from "@sveltejs/kit";
import { parseText } from "$lib/server/parser.js";
import { listDocs, saveDoc } from "$lib/server/storage.js";

/* Tile color varies with the document: a stable hue from title, date and
   origin language so equal inputs always look alike. */
function tileHue(title, date, language) {
  let value = 7;
  for (const ch of `${title || ""}|${date || ""}|${language || ""}`) {
    value = (value * 31 + ch.codePointAt(0)) % 36007;
  }
  return (value * 7) % 360;
}

export function load() {
  const docs = listDocs().map((doc) => ({ ...doc, hue: tileHue(doc.title, doc.date, doc.language) }));
  return { docs };
}

export const actions = {
  default: async ({ request }) => {
    const form = await request.formData();
    const get = (key) => (form.get(key) ?? "").toString();
    const values = {
      title: get("title"),
      date: get("date"),
      language: get("language"),
      translate_to: get("translate_to"),
      text: get("text"),
    };

    let text = values.text.trim();
    const file = form.get("file");
    if (file && typeof file === "object" && "text" in file && file.size > 0) {
      const lower = file.name.toLowerCase();
      if (!lower.endsWith(".txt") && !lower.endsWith(".md")) {
        return fail(400, { error: "Unsupported file format. Use .txt or .md.", values });
      }
      text = (await file.text()).trim();
    }

    if (!text) {
      return fail(400, { error: "Provide text or upload a file.", values });
    }
    if (!values.language) {
      return fail(400, { error: "Select the text language.", values });
    }

    const doc = parseText(text, {
      title: values.title.trim() || "Untitled",
      date: values.date,
      language: values.language,
      translate_to: values.translate_to,
    });

    const id = saveDoc(doc);
    redirect(303, `/process/${id}`);
  },
};
