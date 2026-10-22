// FE copy of `cleanPassageText` in BE/src/utils/passage-text.ts: the backend cleans a pasted passage before it checks
// and saves it, so the form checks and counts the text the same way. Keep the two the same (the tests use the same
// samples).

// Something that looks like an HTML tag: `<b>`, `</p>`, `<br/>`, `<a href="...">`. A lone `<` (as in `a < b`) stays.
const HTML_TAG = /<\/?[a-z][^<>]*>/gi;

// Control characters and invisible format characters (zero-width space, joiners, BOM, soft hyphen, direction marks),
// except tabs and line breaks: those separate words and become a space below.
const HIDDEN = /(?![\t\n\v\f\r])[\p{Cc}\p{Cf}]/gu;

// Typographic punctuation, and the keyboard character a learner types for it.
const TYPOGRAPHIC: [RegExp, string][] = [
  [/[‘’‚‛′]/g, "'"], // ‘ ’ ‚ ‛ ′
  [/[“”„‟″«»]/g, '"'], // “ ” „ ‟ ″ « »
  [/[‐-―−]/g, '-'], // ‐ ‑ ‒ – — ― −
  [/…/g, '...'], // …
];

/**
 * Cleans pasted text: Unicode NFC (Vietnamese letters in their composed form), no HTML tags, no hidden characters,
 * typographic quotes, dashes and ellipsis replaced by the keyboard ones, and every run of white space (line breaks
 * included) turned into one space, trimmed.
 */
export const cleanPassageText = (text: string) => {
  let clean = text.normalize('NFC').replace(HTML_TAG, ' ').replace(HIDDEN, '');
  for (const [pattern, replacement] of TYPOGRAPHIC) clean = clean.replace(pattern, replacement);
  return clean.replace(/\s+/g, ' ').trim();
};
