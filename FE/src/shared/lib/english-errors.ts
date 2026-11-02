// Classifies how a typed English word differs from its target word (SCRUM-218, US2.6), the English set next to the
// Vietnamese one (vietnamese-errors.ts): English has no tones or vowel marks, so its errors are about the letters, their
// case and the punctuation that stays attached to a word ("bread," "don't").
// Pure TypeScript with no DOM, React or Node.js APIs, so the same file can run in the browser and in Node.js.
// BE copy of this file: BE/src/utils/english-errors.ts. Keep both files identical.

export const EnglishError = {
  LETTER_WRONG: 'LETTER_WRONG',
  LETTER_MISSING: 'LETTER_MISSING',
  LETTER_EXTRA: 'LETTER_EXTRA',
  LETTERS_SWAPPED: 'LETTERS_SWAPPED',
  CASE_WRONG: 'CASE_WRONG',
  PUNCTUATION_WRONG: 'PUNCTUATION_WRONG',
} as const;

export type EnglishErrorType = (typeof EnglishError)[keyof typeof EnglishError];

/** Letters and digits; every other character of a word is punctuation (. , ; : ! ? ' " - and the like). */
const LETTER = /[\p{L}\p{M}\p{N}]/u;

const isLetter = (char: string) => LETTER.test(char);

/** A letter with a capital and a small form, so it can be typed in the wrong case. */
const hasCase = (char: string) => char.toLowerCase() !== char.toUpperCase();

/** The characters of a word after NFC normalization, so a letter typed with a combining accent is one character. */
const charsOf = (word: string) => Array.from(word.normalize('NFC'));

/** Whether the two characters of the target before `i` were typed the other way round before `j` ("teh" for "the"). */
const isSwap = (want: string[], got: string[], i: number, j: number) =>
  i > 1 && j > 1 && want[i - 1] !== want[i - 2] && want[i - 1] === got[j - 2] && want[i - 2] === got[j - 1];

/**
 * The error of one edit, named after the character the word has there (`want`): a letter typed as another character,
 * in the wrong case or left out (`got` is '' then), or a punctuation mark typed wrong or left out. A character too many
 * (`want` is '') is named after what was typed: a letter or a stray punctuation mark.
 */
const editError = (want: string, got: string): EnglishErrorType => {
  if (!want) return isLetter(got) ? EnglishError.LETTER_EXTRA : EnglishError.PUNCTUATION_WRONG;
  if (!isLetter(want)) return EnglishError.PUNCTUATION_WRONG;
  if (!got) return EnglishError.LETTER_MISSING;
  return want.toLowerCase() === got.toLowerCase() ? EnglishError.CASE_WRONG : EnglishError.LETTER_WRONG;
};

/**
 * Errors of `typed` compared with `target`; an empty list means the word is correct. One word can have several errors,
 * each listed once, in the order of EnglishError. The two words are lined up with the fewest edits (a character typed as
 * another, left out or too many, or two neighbours typed the other way round: the Damerau–Levenshtein distance) and
 * every edit is named by `editError`. Two letters swapped are LETTERS_SWAPPED; a punctuation mark swapped with a letter
 * is PUNCTUATION_WRONG (it is out of place). Case is compared: `the` for `The` is a CASE_WRONG error.
 */
export const classifyEnglishWord = (target: string, typed: string): EnglishErrorType[] => {
  const want = charsOf(target);
  const got = charsOf(typed);
  // edits[i][j]: the fewest edits that turn the first i characters of the target into the first j typed ones.
  const edits: number[][] = [];
  for (let i = 0; i <= want.length; i++) {
    edits.push([]);
    for (let j = 0; j <= got.length; j++) {
      if (i === 0 || j === 0) {
        edits[i][j] = i + j;
        continue;
      }
      edits[i][j] = Math.min(
        edits[i - 1][j] + 1, // the target character left out
        edits[i][j - 1] + 1, // a typed character too many
        edits[i - 1][j - 1] + (want[i - 1] === got[j - 1] ? 0 : 1), // the same character, or another one
      );
      if (isSwap(want, got, i, j)) edits[i][j] = Math.min(edits[i][j], edits[i - 2][j - 2] + 1);
    }
  }

  // Walk back from the end along one of the cheapest ways and name every edit on it.
  const found = new Set<EnglishErrorType>();
  let i = want.length;
  let j = got.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && want[i - 1] === got[j - 1] && edits[i][j] === edits[i - 1][j - 1]) {
      i -= 1;
      j -= 1;
    } else if (isSwap(want, got, i, j) && edits[i][j] === edits[i - 2][j - 2] + 1) {
      const letters = isLetter(want[i - 2]) && isLetter(want[i - 1]);
      found.add(letters ? EnglishError.LETTERS_SWAPPED : EnglishError.PUNCTUATION_WRONG);
      i -= 2;
      j -= 2;
    } else if (i > 0 && j > 0 && edits[i][j] === edits[i - 1][j - 1] + 1) {
      found.add(editError(want[i - 1], got[j - 1]));
      i -= 1;
      j -= 1;
    } else if (i > 0 && edits[i][j] === edits[i - 1][j] + 1) {
      found.add(editError(want[i - 1], ''));
      i -= 1;
    } else {
      found.add(editError('', got[j - 1]));
      j -= 1;
    }
  }
  return Object.values(EnglishError).filter((type) => found.has(type));
};

/**
 * Errors that can happen on a target word ("error opportunities"), used as the denominator of an error rate, as `tagWord`
 * of vietnamese-errors.ts: every word can get a letter too many; a word with letters can get one wrong or left out, and
 * in the wrong case when they have one (Caps Lock and Shift reach every letter, as a tone reaches every Vietnamese word);
 * a swap needs two different letters side by side; a punctuation error needs a punctuation mark in the word. As a vowel
 * mark typed on a Vietnamese word without one, a stray mark on a word without punctuation is still an error, but that
 * word is not a chance of one.
 */
export const tagEnglishWord = (target: string): EnglishErrorType[] => {
  const want = charsOf(target);
  const letters = want.filter(isLetter);
  const opportunities = new Set<EnglishErrorType>([EnglishError.LETTER_EXTRA]);
  if (letters.length > 0) {
    opportunities.add(EnglishError.LETTER_WRONG);
    opportunities.add(EnglishError.LETTER_MISSING);
  }
  if (want.some((char, i) => i > 0 && char !== want[i - 1] && isLetter(char) && isLetter(want[i - 1]))) {
    opportunities.add(EnglishError.LETTERS_SWAPPED);
  }
  if (letters.some(hasCase)) opportunities.add(EnglishError.CASE_WRONG);
  if (letters.length < want.length) opportunities.add(EnglishError.PUNCTUATION_WRONG);
  return Object.values(EnglishError).filter((type) => opportunities.has(type));
};
