/* Main-menu tile look: a stable solid color per document, hashed from
   title, date and origin language. The palette is a curated set of
   saturated book-cover hues. */
const HUES = [
  12, 32, 52, 92, 160, 190, 205, 260, 300, 340,
];

export function tileHue(title, date, language) {
  let value = 7;
  for (const ch of `${title || ""}|${date || ""}|${language || ""}`) {
    value = (value * 31 + ch.codePointAt(0)) % 36007;
  }
  return HUES[(value * 7) % HUES.length];
}
