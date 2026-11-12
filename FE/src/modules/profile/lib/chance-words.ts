import { ERROR_CHANCE_WORDS } from '@/modules/daily-tasks/daily-tasks.config';
import type { SessionErrorType } from '@/shared/lib/typing-language';

/**
 * The words that give a chance of an error type (`tagWord`, `tagEnglishWord`): "words with đ", or `null` where every word
 * does. In English (SCRUM-219) every word can get a letter too many, and every word with letters one wrong, left out or
 * in the wrong case; a swap needs two different letters side by side, a punctuation error a mark in the word.
 */
const CHANCE_WORDS: Record<SessionErrorType, string | null> = {
  ...ERROR_CHANCE_WORDS,
  LETTER_WRONG: null,
  LETTER_MISSING: null,
  LETTER_EXTRA: null,
  LETTERS_SWAPPED: 'words of two letters or more',
  CASE_WRONG: null,
  PUNCTUATION_WRONG: 'words with punctuation',
};

/** The words that give a chance of an error type: "words with đ", or "words" where every word does. */
export const chanceWords = (type: SessionErrorType) => CHANCE_WORDS[type] ?? 'words';

/**
 * "12 more words with đ", "1 more word": what a type still needs for a level, said by its card of the error profile and
 * by a Train lesson of it (SCRUM-274).
 */
export const missingWords = (type: SessionErrorType, missing: number) =>
  `${missing} more ${missing === 1 ? chanceWords(type).replace(/^words/, 'word') : chanceWords(type)}`;
