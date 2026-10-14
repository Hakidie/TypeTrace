// Classifies how a typed Vietnamese word differs from its target word (SCRUM-24, US2.1).
// Pure TypeScript with no DOM, React or Node.js APIs, so the same file can run in the browser and in Node.js.
// BE copy of FE/src/shared/lib/vietnamese-errors.ts (SCRUM-53, SCRUM-54). Keep both files identical.

export const WordError = {
  BASE_LETTER: 'BASE_LETTER',
  D_MISSING: 'D_MISSING',
  MARK_WRONG: 'MARK_WRONG',
  TONE_WRONG: 'TONE_WRONG',
  HOI_NGA_CONFUSION: 'HOI_NGA_CONFUSION',
} as const;

export type WordErrorType = (typeof WordError)[keyof typeof WordError];

const CIRCUMFLEX = '̂'; // â ê ô
const BREVE = '̆'; // ă
const HORN = '̛'; // ơ ư
const HUYEN = '̀';
const SAC = '́';
const NGA = '̃';
const HOI = '̉';
const NANG = '̣';

const VOWEL_MARKS = new Set([CIRCUMFLEX, BREVE, HORN]);
const TONES = new Set([HUYEN, SAC, NGA, HOI, NANG]);

type ParsedWord = {
  /** Letters without diacritics; `đ` is read as `d`. Case is kept. */
  base: string;
  /** Per letter: its vowel mark ('' for none). */
  marks: string[];
  /** Per letter: whether it is a crossed d (đ). */
  strokes: boolean[];
  /** The tone of the whole word ('' for none). Where it sits in the word does not matter. */
  tone: string;
};

/** Splits a word into base letters, vowel marks, stroked d and tone, after NFC/NFD normalization. */
const parse = (word: string): ParsedWord => {
  const parsed: ParsedWord = { base: '', marks: [], strokes: [], tone: '' };
  for (const char of word.normalize('NFD')) {
    if (VOWEL_MARKS.has(char)) {
      parsed.marks[parsed.marks.length - 1] = char;
    } else if (TONES.has(char)) {
      parsed.tone = char;
    } else if (char === 'đ' || char === 'Đ') {
      parsed.base += char === 'đ' ? 'd' : 'D';
      parsed.marks.push('');
      parsed.strokes.push(true);
    } else {
      parsed.base += char;
      parsed.marks.push('');
      parsed.strokes.push(false);
    }
  }
  return parsed;
};

const isHoiNga = (tone: string) => tone === HOI || tone === NGA;

/**
 * Errors of `typed` compared with `target`; an empty list means the word is correct. One word can have several errors.
 * Case is compared as is: a wrong case is a BASE_LETTER error (ASSUMPTION). Marks and đ are only compared when the
 * base letters match, because positions mean nothing otherwise; the tone is always compared.
 */
export const classifyWord = (target: string, typed: string): WordErrorType[] => {
  const want = parse(target);
  const got = parse(typed);
  const errors: WordErrorType[] = [];

  if (want.base !== got.base) {
    errors.push(WordError.BASE_LETTER);
  } else {
    // Typing đ where the target has d is an extra letter; typing d where the target has đ is a missing stroke.
    if (want.strokes.some((stroke, i) => stroke && !got.strokes[i])) errors.push(WordError.D_MISSING);
    if (want.strokes.some((stroke, i) => !stroke && got.strokes[i])) errors.push(WordError.BASE_LETTER);
    if (want.marks.some((mark, i) => mark !== got.marks[i])) errors.push(WordError.MARK_WRONG);
  }

  if (want.tone !== got.tone) {
    // hỏi and ngã are confused so often that they get their own category instead of TONE_WRONG.
    errors.push(isHoiNga(want.tone) && isHoiNga(got.tone) ? WordError.HOI_NGA_CONFUSION : WordError.TONE_WRONG);
  }
  return errors;
};

/**
 * Errors that can happen on a target word ("error opportunities"), used as the denominator of an error rate:
 * rate of X = times X happened / times X could have happened.
 */
export const tagWord = (target: string): WordErrorType[] => {
  const want = parse(target);
  const opportunities: WordErrorType[] = [WordError.BASE_LETTER, WordError.TONE_WRONG];
  if (want.strokes.some(Boolean)) opportunities.push(WordError.D_MISSING);
  if (want.marks.some(Boolean)) opportunities.push(WordError.MARK_WRONG);
  if (isHoiNga(want.tone)) opportunities.push(WordError.HOI_NGA_CONFUSION);
  return opportunities;
};
