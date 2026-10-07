const ES_DET = new Set([
  "el", "la", "los", "las", "un", "una", "unos", "unas",
  "mi", "mis", "tu", "tus", "su", "sus",
  "nuestro", "nuestra", "nuestros", "nuestras",
  "vuestro", "vuestra", "vuestros", "vuestras",
  "este", "esta", "estos", "estas",
  "ese", "esa", "esos", "esas",
  "aquel", "aquella", "aquellos", "aquellas",
]);

const ES_PREP = new Set([
  "de", "a", "en", "por", "para", "con", "sin", "sobre", "entre", "desde", "hasta",
]);

const ES_PREP_ART = new Set(["el", "la", "los", "las", "un", "una"]);

export { ES_DET, ES_PREP, ES_PREP_ART };
