// Word rules of the typing screen. Measured with Unikey and EVKey: docs/ime-findings.md

/** Characters that end a word: whitespace (also the non-breaking space of contenteditable) and punctuation. */
const SEPARATOR = /[\s.,;:!?…"“”()]/u;
const SEPARATORS = /[\s.,;:!?…"“”()]+/u;

/** Vietnamese tone marks after NFD: huyền, sắc, ngã, hỏi, nặng. Vowel marks (â, ă, ơ, ư) are not tones. */
const TONE_MARKS = /[̣̀́̃̉]/gu;

/** Words of `text` that are followed by a separator, i.e. the user has moved past them. */
export const completedWords = (text: string): string[] => {
  let end = text.length;
  while (end > 0 && !SEPARATOR.test(text[end - 1])) end -= 1;
  return text.slice(0, end).split(SEPARATORS).filter(Boolean);
};

/** The word being typed: the text after the last separator (empty right after a separator). */
export const currentWord = (text: string): string => {
  let start = text.length;
  while (start > 0 && !SEPARATOR.test(text[start - 1])) start -= 1;
  return text.slice(start);
};

/**
 * Comparison key that ignores where the tone mark sits and how the text is encoded:
 * "hoà"/"hòa", "thuỷ"/"thủy" and NFC/NFD forms give the same key. Case is kept.
 */
export const wordKey = (word: string): string => {
  const decomposed = word.normalize('NFD');
  const tones = decomposed.match(TONE_MARKS)?.join('') ?? '';
  return `${decomposed.replace(TONE_MARKS, '').normalize('NFC')}|${tones}`;
};

/**
 * Whether a typed word is the expected word. Use this instead of `===`: Unikey places tones the old way (hòa)
 * and EVKey the new way (hoà) by default, and both spellings are correct.
 */
export const isSameWord = (typed: string, expected: string): boolean => wordKey(typed) === wordKey(expected);
