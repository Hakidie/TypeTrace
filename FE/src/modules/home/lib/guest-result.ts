import { accuracyOf, checkWords, summarizeErrors } from '@/modules/typing/utils/typing-session';

const CHARS_PER_WORD = 5;

/** Same count as `countWpmChars` in the backend: the characters of the correct words, plus the spaces between them. */
const countWpmChars = (words: string[]) =>
  words.reduce((sum, word) => sum + word.normalize('NFC').length, 0) + Math.max(words.length - 1, 0);

/** What the guest sees at the end of the test. The numbers are worked out in the browser, like the server does for a learner. */
export const summarizeGuestRun = (targetWords: string[], typedWords: string[], durationMs: number) => {
  const results = checkWords(targetWords, typedWords);
  const correct = results.filter((result) => result.errors.length === 0).map((result) => result.target);
  // At least one second, like the server, so an instant run stays finite.
  const minutes = Math.max(durationMs, 1000) / 60000;
  return {
    results,
    stats: summarizeErrors(results),
    accuracy: accuracyOf(results),
    wpm: Math.round((countWpmChars(correct) / CHARS_PER_WORD / minutes) * 10) / 10,
    durationMs,
  };
};

export type GuestRun = ReturnType<typeof summarizeGuestRun>;
