import { i18n } from '@/shared/i18n/i18n';
import type { SessionErrorType } from '@/shared/lib/typing-language';

/**
 * The words that give a chance of an error type (`tagWord`, `tagEnglishWord`): "words with đ", or `null` where every word
 * does. In English (SCRUM-219) every word can get a letter too many, and every word with letters one wrong, left out or
 * in the wrong case; a swap needs two different letters side by side, a punctuation error a mark in the word.
 */
// The names are the `chance.*` keys of the `profile` namespace (SCRUM-331): `any` where every word does.
const CHANCE_KEYS: Record<SessionErrorType, string> = {
  BASE_LETTER: 'any',
  D_MISSING: 'D_MISSING',
  MARK_WRONG: 'MARK_WRONG',
  TONE_WRONG: 'any',
  HOI_NGA_CONFUSION: 'HOI_NGA_CONFUSION',
  LETTER_WRONG: 'any',
  LETTER_MISSING: 'any',
  LETTER_EXTRA: 'any',
  LETTERS_SWAPPED: 'LETTERS_SWAPPED',
  CASE_WRONG: 'any',
  PUNCTUATION_WRONG: 'PUNCTUATION_WRONG',
};

/** The words that give a chance of the type, in the plural ("words with đ"), or "words" where every word does. */
export const chanceWords = (type: SessionErrorType, lng?: string) => i18n.t(`profile:chance.${CHANCE_KEYS[type]}`, { count: 2, lng });

/** "3 more words with đ" for a type that still needs `missing` of them to be judged; "1 more word with đ" for one. */
export const missingWords = (type: SessionErrorType, missing: number, lng?: string) =>
  i18n.t('profile:errorCard.missing', { count: missing, lng, what: i18n.t(`profile:chance.${CHANCE_KEYS[type]}`, { count: missing, lng }) });
