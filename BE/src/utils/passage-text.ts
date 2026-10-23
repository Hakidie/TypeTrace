// Text a learner pastes as a passage (`POST /api/passages`) is cleaned before it is checked and saved, so every word
// can be typed on a normal keyboard and nothing hidden is kept. FE/src/modules/passages/lib/passage-text.ts has a copy
// of `cleanPassageText`, so the form checks the text as it will be saved: keep the two the same. Also the title search
// of `GET /api/passages`.

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
  [/…/g, '...'] // …
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

// Every letter a plain letter can stand for in a search: `a` also finds `à`, `ă`, `ấ`..., `d` also finds `đ`.
const ACCENTED_FORMS: Record<string, string> = {
  a: 'aàáảãạăằắẳẵặâầấẩẫậ',
  d: 'dđ',
  e: 'eèéẻẽẹêềếểễệ',
  i: 'iìíỉĩị',
  o: 'oòóỏõọôồốổỗộơờớởỡợ',
  u: 'uùúủũụưừứửữự',
  y: 'yỳýỷỹỵ'
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A case-insensitive pattern that finds `text` in a title the way learners search: a letter typed without its marks
 * finds every accented form (`ha noi` finds `Hà Nội`, `duong` finds `Đường`), a letter typed with them only finds
 * itself, and anything else is taken literally. Composed (NFC) like the saved titles.
 */
export const titleSearchPattern = (text: string) => {
  const parts = [...text.normalize('NFC')].map((char) => {
    const forms = ACCENTED_FORMS[char.toLowerCase()];
    return forms ? `[${forms}]` : escapeRegex(char);
  });
  return new RegExp(parts.join(''), 'i');
};
