import { classifyWord, tagWord, WordError, type WordErrorType } from '@/shared/lib/vietnamese-errors';

export interface WordResult {
  index: number;
  target: string;
  typed: string;
  /** Empty when the word is correct. */
  errors: WordErrorType[];
}

export interface ErrorStat {
  type: WordErrorType;
  /** Times this error happened. */
  count: number;
  /** Times it could have happened (error opportunities of the typed words). */
  chances: number;
}

export const toWords = (text: string) => text.split(/\s+/).filter(Boolean);

/** A word is finished when a space follows it; the text after the last space is the word being typed. */
export const splitTyped = (text: string): { done: string[]; current: string } => {
  const words = toWords(text);
  if (/\s$/.test(text) || words.length === 0) return { done: words, current: '' };
  return { done: words.slice(0, -1), current: words[words.length - 1] };
};

/** Compares each finished word with the target word at the same position. Extra words are ignored. */
export const checkWords = (targetWords: string[], typedWords: string[]): WordResult[] =>
  typedWords.slice(0, targetWords.length).map((typed, index) => ({
    index,
    target: targetWords[index],
    typed,
    errors: classifyWord(targetWords[index], typed),
  }));

/** Per error type: how often it happened against how often it could have. Types that never had a chance are left out. */
export const summarizeErrors = (results: WordResult[]): ErrorStat[] =>
  Object.values(WordError)
    .map((type) => ({
      type,
      count: results.filter((result) => result.errors.includes(type)).length,
      chances: results.filter((result) => tagWord(result.target).includes(type)).length,
    }))
    .filter((stat) => stat.chances > 0);

/** Share of finished words typed without any error, 0-100. */
export const accuracyOf = (results: WordResult[]): number =>
  results.length === 0 ? 100 : Math.round((results.filter((r) => r.errors.length === 0).length / results.length) * 100);
