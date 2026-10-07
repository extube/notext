const DE_DET = new Set([
  "der", "die", "das", "den", "dem", "des",
  "ein", "eine", "einen", "einem", "einer", "eines",
  "mein", "meine", "meinen", "meinem", "meiner",
  "dein", "deine", "deinen", "deinem", "deiner",
  "sein", "seine", "seinen", "seinem", "seiner",
  "ihr", "ihre", "ihren", "ihrem", "ihrer",
  "unser", "unsere", "unseren", "unserem", "unserer",
  "euer", "eure", "euren", "eurem", "eurer",
]);

const DE_PREP = new Set([
  "in", "an", "auf", "aus", "bei", "mit", "nach", "von", "zu",
  "vor", "über", "unter", "für", "durch", "um", "ohne",
]);

const DE_PREP_ART = new Set(["der", "die", "das", "den", "dem", "des"]);

export { DE_DET, DE_PREP, DE_PREP_ART };
