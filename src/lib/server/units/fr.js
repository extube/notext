const FR_DET = new Set([
  "l'", "d'", "le", "la", "les", "un", "une", "des", "du",
  "au", "aux", "mon", "ma", "mes", "ton", "ta", "tes",
  "son", "sa", "ses", "notre", "nos", "votre", "vos", "leurs",
  "ce", "cet", "cette", "ces",
]);

const FR_PREP = new Set(["de", "à"]);

const FR_PREP_ART = new Set(["la", "les", "l'", "leur"]);
const FR_Y_VERBS = new Set(["a", "avait", "avaient", "aura", "auront"]);

/* French elisions are split into two units so "qu'il", "s'il", "j'ai" …
   stay clickable word by word; "aujourd'hui" style compounds are not split
   because their head is not a known elision particle. Compounds must come
   before the simple forms that they contain. */
const FR_ELISIONS = [
  "puisqu'", "jusqu'", "lorsqu'",
  "qu'", "s'", "c'", "j'", "n'", "m'", "l'", "d'", "t'",
];

export { FR_DET, FR_PREP, FR_PREP_ART, FR_Y_VERBS, FR_ELISIONS };
