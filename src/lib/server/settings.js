import fs from "node:fs";
import path from "node:path";

const SETTINGS_PATH = path.join(process.cwd(), "data", "settings.json");

/* Site-managed LLM provider. No host by default — the services fallback
   (MyMemory / Wiktionary) covers lookups until the owner configures one. */
const DEFAULTS = {
  llm: { host: "", port: "", key: "", model: "" },
};

export function loadSettings() {
  try {
    const raw = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8"));
    return {
      llm: {
        host: raw?.llm?.host || DEFAULTS.llm.host,
        port: raw?.llm?.port || DEFAULTS.llm.port,
        key: raw?.llm?.key || DEFAULTS.llm.key,
        model: raw?.llm?.model || DEFAULTS.llm.model,
      },
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export function saveSettings(partial) {
  const merged = structuredClone(loadSettings());
  if (partial?.llm) {
    merged.llm = { ...merged.llm, ...partial.llm };
  }
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(merged, null, 2));
  return merged;
}

/* Maps language codes to clear names for the translation prompt. */
export function languageName(code) {
  return NAMES[(code || "").toLowerCase()] || code || "";
}

const NAMES = {
  ru: "Russian",
  fr: "French",
  "en-gb": "English (UK)",
  "en-us": "English (US)",
  es: "Spanish",
  it: "Italian",
  de: "German",
};
