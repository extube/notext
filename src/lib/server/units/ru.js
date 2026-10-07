/* Russian has no articles and no elisions; prepositions carry the
   article-like role, so preposition + following word is one unit. */
const RU_PREP = new Set([
  "в", "во", "на", "с", "со", "к", "ко", "у", "о", "об", "обо",
  "от", "до", "из", "из-за", "за", "под", "над", "без", "для",
  "по", "про", "около", "после", "перед",
]);

export { RU_PREP };
