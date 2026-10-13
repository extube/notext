/* Main-menu tile look: a stable hue per document, hashed from title,
   date and origin language so equal inputs always look alike. */
export function tileHue(title, date, language) {
  let value = 7;
  for (const ch of `${title || ""}|${date || ""}|${language || ""}`) {
    value = (value * 31 + ch.codePointAt(0)) % 36007;
  }
  return (value * 7) % 360;
}
