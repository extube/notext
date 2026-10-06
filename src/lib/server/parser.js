import {
  FR_DET,
  FR_PREP,
  FR_PREP_ART,
  FR_Y_VERBS,
  FR_ELISIONS,
} from "./units/fr.js";
import { EN_THERE, EN_ARTICLES } from "./units/en.js";

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

/* Logical word units: articles/possessives join the following noun,
   "il y a" stays together, so click-to-translate sees whole units.
   Unit word lists live per language in src/lib/server/units/. */

/* Both apostrophe spellings (`'` ASCII and `’` curly from autocorrect)
   match the same unit lists; joins keep the original spelling. */
function norm(word) {
  return (word || "").toLowerCase().replace(/’/g, "'");
}

export function splitElisions(words) {
  return words.flatMap((word) => {
    const head = FR_ELISIONS.find((e) => norm(word).startsWith(e));
    if (head && word.length > head.length) {
      return [word.slice(0, head.length), word.slice(head.length)];
    }
    return [word];
  });
}

export function chunkWords(words, language) {
  if (!/^(fr|en-GB|en-US)$/.test(language || "")) {
    return words;
  }
  const isFr = language.startsWith("fr");
  const out = [];
  let i = 0;
  while (i < words.length) {
    const word = words[i];
    const next = words[i + 1];
    const nextNext = words[i + 2];
    const lower = norm(word);
    const nextLower = next ? norm(next) : "";

    if (isFr) {
      if (
        lower === "il" && nextLower === "y" && FR_Y_VERBS.has(norm(nextNext))
      ) {
        out.push(`${word} ${next} ${nextNext}`);
        i += 3;
      } else if (
        FR_PREP.has(lower) && FR_PREP_ART.has(nextLower) && nextNext
      ) {
        out.push(`${word} ${next} ${nextNext}`);
        i += 3;
      } else if (FR_DET.has(lower) && next) {
        out.push(`${word} ${next}`);
        i += 2;
      } else {
        out.push(word);
        i += 1;
      }
    } else {
      if (
        lower === "there" && EN_THERE.has(nextLower)
      ) {
        out.push(`${word} ${next}`);
        i += 2;
      } else if (EN_ARTICLES.has(lower) && next) {
        out.push(`${word} ${next}`);
        i += 2;
      } else {
        out.push(word);
        i += 1;
      }
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
      if ((meta.language || "").startsWith("fr")) {
        words = splitElisions(words);
      }
      return { words: chunkWords(words, meta.language) };
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
