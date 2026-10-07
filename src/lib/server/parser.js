import {
  FR_DET,
  FR_PREP,
  FR_PREP_ART,
  FR_Y_VERBS,
  FR_ELISIONS,
} from "./units/fr.js";
import { EN_THERE, EN_ARTICLES } from "./units/en.js";
import { ES_DET, ES_PREP, ES_PREP_ART } from "./units/es.js";
import { IT_DET, IT_PREP, IT_PREP_ART, IT_ELISIONS } from "./units/it.js";
import { DE_DET, DE_PREP, DE_PREP_ART } from "./units/de.js";
import { RU_PREP } from "./units/ru.js";

/* Per-language chunking config:
   - elisions: split particle elisions before chunking (fr, it)
   - det: head merges with the next word into one unit
   - prep + prepArt: 3-token unit "prep + article + word"
   - triple: fixed 3-token phrase with a variable tail verb
   - pair: fixed head + variable tail merges into 2 tokens */
const CHUNK_CFG = {
  fr: {
    elisions: FR_ELISIONS,
    det: FR_DET,
    prep: FR_PREP,
    prepArt: FR_PREP_ART,
    triple: { head: "il", mid: "y", tails: FR_Y_VERBS },
  },
  "en-GB": {
    det: EN_ARTICLES,
    pair: { head: "there", tails: EN_THERE },
  },
  "en-US": {
    det: EN_ARTICLES,
    pair: { head: "there", tails: EN_THERE },
  },
  es: { det: ES_DET, prep: ES_PREP, prepArt: ES_PREP_ART },
  it: { elisions: IT_ELISIONS, det: IT_DET, prep: IT_PREP, prepArt: IT_PREP_ART },
  de: { det: DE_DET, prep: DE_PREP, prepArt: DE_PREP_ART },
  ru: { det: RU_PREP },
};

const SENTENCE_RE = /[^.!?…]+[.!?…]+[)"'»”\]]*|[^.!?…]+/g;

export function splitParts(text) {
  return text
    .split(/\n\s*\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function splitSentences(part) {
  const raw = part.match(SENTENCE_RE) || [];
  return raw.map((s) => s.trim()).filter(Boolean);
}

export function splitWords(sentence) {
  return sentence.trim().split(/\s+/).filter(Boolean);
}

/* Marks are peeled off both edges of every unit so symbols like `.`, `!`,
   `?`, `«`, `»` become their own (non-clickable) units. A run counts as
   one mark combo; apostrophes and hyphens inside words (`qu'`, `из-за`)
   never split — but a leading dash like `—Bonjour` does. */
const LEADING_PUNCT_RE = /^[¡¿«"“„([\-–—]+/u;
const TRAILING_PUNCT_RE = /[.!?…,:;»”)\]]+$/u;

export function peelPunctuation(word) {
  let rest = word;
  const lead = rest.match(LEADING_PUNCT_RE)?.[0] ?? "";
  rest = rest.slice(lead.length);
  const trail = rest.match(TRAILING_PUNCT_RE)?.[0] ?? "";
  const core = rest.slice(0, rest.length - trail.length);
  return [lead, core, trail].filter(Boolean);
}

/* Logical word units: articles/possessives join the following noun,
   "il y a" stays together, so click-to-translate sees whole units.
   Unit word lists live per language in src/lib/server/units/. */

/* Both apostrophe spellings (`'` ASCII and `’` curly from autocorrect)
   match the same unit lists; joins keep the original spelling. Opening
   marks glue onto the first word ("¡La", '"Der") and must not break
   det/prep matching; apostrophes are never stripped ("l'", "un'"). */
function norm(word) {
  return (word || "")
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/^[¡¿«"“„]+/, "")
    .replace(/[»”",.:;!?…()\\]]+$/, "");
}

export function splitElisions(words, elisions) {
  return words.flatMap((word) => {
    const head = elisions.find((e) => norm(word).startsWith(e));
    if (head && word.length > head.length) {
      return [word.slice(0, head.length), word.slice(head.length)];
    }
    return [word];
  });
}

export function chunkWords(words, language) {
  const cfg = CHUNK_CFG[language];
  if (!cfg) {
    return words;
  }
  const out = [];
  let i = 0;
  while (i < words.length) {
    const word = words[i];
    const next = words[i + 1];
    const nextNext = words[i + 2];
    const lower = norm(word);
    const nextLower = next ? norm(next) : "";

    if (
      cfg.triple && lower === cfg.triple.head &&
      nextLower === cfg.triple.mid && cfg.triple.tails.has(norm(nextNext))
    ) {
      out.push(`${word} ${next} ${nextNext}`);
      i += 3;
    } else if (cfg.pair && lower === cfg.pair.head && cfg.pair.tails.has(nextLower)) {
      out.push(`${word} ${next}`);
      i += 2;
    } else if (cfg.prep && cfg.prep.has(lower) && cfg.prepArt.has(nextLower) && nextNext) {
      out.push(`${word} ${next} ${nextNext}`);
      i += 3;
    } else if (cfg.det && cfg.det.has(lower) && next) {
      out.push(`${word} ${next}`);
      i += 2;
    } else {
      out.push(word);
      i += 1;
    }
  }
  return out;
}

export function parseText(text, meta) {
  const doc = {
    title: meta.title || "",
    date: meta.date || "",
    language: meta.language || "",
    translate_to: meta.translate_to || "",
  };

  splitParts(text).forEach((part, index) => {
    const sentences = splitSentences(part).map((sentence) => {
      let words = splitWords(sentence);
      const elisions = CHUNK_CFG[meta.language]?.elisions;
      if (elisions) {
        words = splitElisions(words, elisions);
      }
      return { words: chunkWords(words, meta.language).flatMap(peelPunctuation) };
    });
    doc[`part_${index + 1}`] = { sentences };
  });

  return doc;
}

export function buildStats(doc) {
  let parts = 0;
  let sentences = 0;
  let words = 0;

  for (const key of Object.keys(doc)) {
    if (!key.startsWith("part_")) continue;
    parts += 1;
    for (const sentence of doc[key].sentences) {
      sentences += 1;
      words += sentence.words.length;
    }
  }

  return { parts, sentences, words };
}
