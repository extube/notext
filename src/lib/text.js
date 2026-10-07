/* Client-safe text helpers shared by pages that render parsed units
   (parser.js itself must stay server-only). */

/* Any unit without a letter or digit renders as plain text:
   `.` `,` `«` `»` `—` `?!` … */
const PUNCT_UNIT_RE = /^[^\p{L}\p{N}]+$/u;

/* Closing marks glue to the previous word; opening marks (« — „) keep
   a preceding space. */
const CLOSING_RE = /^[.,!?…:;»”)\]]+$/u;

export function isPunctUnit(word) {
  return PUNCT_UNIT_RE.test(word);
}

export function isClosingPunct(word) {
  return CLOSING_RE.test(word);
}

/* Sentence text with punctuation glued to the previous word
   ("nuages." not "nuages ."). */
export function joinWords(words) {
  let out = "";
  for (const word of words) {
    if (out && !isClosingPunct(word)) {
      out += " ";
    }
    out += word;
  }
  return out;
}
