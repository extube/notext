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

export function parseText(text, meta) {
  const doc = {
    title: meta.title || "",
    date: meta.date || "",
    language: meta.language || "",
  };

  splitParts(text).forEach((part, index) => {
    const sentences = splitSentences(part).map((sentence) => ({
      words: splitWords(sentence),
    }));
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
