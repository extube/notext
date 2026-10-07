const IT_DET = new Set([
  "l'", "il", "lo", "la", "i", "gli", "le", "un", "un'",
  "uno", "una",
  "mio", "mia", "miei", "mie", "tuo", "tua", "tuoi", "tue",
  "suo", "sua", "suoi", "sue", "nostro", "nostra", "nostri", "nostre",
  "vostro", "vostra", "vostri", "vostre", "loro",
  "questo", "questa", "questi", "queste",
  "quel", "quello", "quella", "quelli", "quelle",
]);

const IT_PREP = new Set([
  "di", "a", "da", "in", "con", "su", "per", "tra", "fra",
]);

/* "di il" style pairs do not occur (they are fused: del, alla, nel …),
   but "con la madre", "per la strada" do. */
const IT_PREP_ART = new Set(["il", "lo", "la", "i", "gli", "le", "l'", "un", "un'", "uno", "una"]);

/* Only particle elisions split ("l'amico", "un'amica", "quest'anno" …);
   articular contractions ("dell'anno", "nell'ora"), like French "du",
   stay whole because their article is already inside the token. */
const IT_ELISIONS = ["quest'", "un'", "l'"];

export { IT_DET, IT_PREP, IT_PREP_ART, IT_ELISIONS };
