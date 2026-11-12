import { classifyIn, errorTypesOf, type SessionErrorType, tagIn, type TypingLanguage } from '@/shared/lib/typing-language';
import { SESSION_TIME_LIMIT_SECONDS } from '../typing.config';
import type { ErrorCounts } from '../types/typing.types';

/** A session under this accuracy stays off the placement leaderboard (`MIN_PLACEMENT_BOARD_ACCURACY` in the backend). */

export interface WordResult {
  index: number;
  target: string;
  typed: string;
  /** Empty when the word is correct. The types of the session's language (SCRUM-219). */
  errors: SessionErrorType[];
}

export interface ErrorStat {
  type: SessionErrorType;
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

/** Compares each finished word with the target word at the same position, by the rules of `language` (SCRUM-219). Extra words are ignored. */
export const checkWords = (targetWords: string[], typedWords: string[], language: TypingLanguage = 'vi'): WordResult[] =>
  typedWords.slice(0, targetWords.length).map((typed, index) => ({
    index,
    target: targetWords[index],
    typed,
    errors: classifyIn(language, targetWords[index], typed),
  }));

/** Per error type of `language`: how often it happened against how often it could have. Types that never had a chance are left out. */
export const summarizeErrors = (results: WordResult[], language: TypingLanguage = 'vi'): ErrorStat[] =>
  errorTypesOf(language)
    .map((type) => ({
      type,
      count: results.filter((result) => result.errors.includes(type)).length,
      chances: results.filter((result) => tagIn(language, result.target).includes(type)).length,
    }))
    .filter((stat) => stat.chances > 0);

/** Share of finished words typed without any error, 0-100. */
export const accuracyOf = (results: WordResult[]): number =>
  results.length === 0 ? 100 : Math.round((results.filter((r) => r.errors.length === 0).length / results.length) * 100);

/** "1:05" for 65 seconds. */
export const formatDuration = (totalSeconds: number) =>
  `${Math.floor(totalSeconds / 60)}:${String(Math.floor(totalSeconds % 60)).padStart(2, '0')}`;

/**
 * Turns the counts saved by the server into the rows of the error-rate list, for the error set of the session's `language`
 * (SCRUM-219: a session stores the counts of its own language only). Types that never had a chance are left out.
 */
export const statsFromCounts = (errorCounts: ErrorCounts, opportunityCounts: ErrorCounts, language: TypingLanguage = 'vi'): ErrorStat[] =>
  errorTypesOf(language)
    .map((type) => ({ type, count: errorCounts[type] ?? 0, chances: opportunityCounts[type] ?? 0 }))
    .filter((stat) => stat.chances > 0);

/** What a placement session tells about the placement leaderboard (US10.1), or `null` for another mode. Mirrors `isSessionOnPlacementBoard` of the backend. */
export const placementBoardNote = (
  session: {
    mode: string;
    isOnPlacementBoard?: boolean;
    chosenLimitSeconds?: number;
    isCounted: boolean;
    accuracy?: number;
  },
  /** The minimum accuracy of the leaderboard (an admin setting, `usePlacementMinAccuracy`). */
  minAccuracy: number,
): { onBoard: boolean; text: string } | null => {
  if (session.mode !== 'placement') return null;
  if (session.isOnPlacementBoard) return { onBoard: true, text: 'This session is on the placement leaderboard.' };
  const notOnBoard = 'This session is not on the placement leaderboard: ';
  if (session.chosenLimitSeconds !== SESSION_TIME_LIMIT_SECONDS) return { onBoard: false, text: `${notOnBoard}only 3-minute placement sessions are ranked.` };
  if (!session.isCounted) return { onBoard: false, text: `${notOnBoard}it needs at least 20 words and at most 200 WPM to be ranked.` };
  if ((session.accuracy ?? 0) < minAccuracy) return { onBoard: false, text: `${notOnBoard}an accuracy under ${minAccuracy}% is not ranked.` };
  return { onBoard: false, text: `${notOnBoard}a 3-minute session must last the 3 minutes or finish the whole passage.` };
};
