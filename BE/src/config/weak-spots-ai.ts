import type { TypingLanguage } from '../utils/typing-language';

/**
 * The AI writer of the Weak spots lessons (SCRUM-28, US3.2): it turns the words picked for the lesson into a short passage
 * that makes sense, in the language of the lesson (SCRUM-319: Vietnamese or English). The server checks what it wrote
 * (`checkAiPassage`); a failed or refused answer leaves the lesson as the list of picked words, and the learner sees no error.
 */
export const weakSpotsAi = {
  /** What the AI is told, in the language of the lesson. */
  systemPrompts: {
    vi: [
      'You write typing lessons for Vietnamese learners.',
      'Write ONE Vietnamese passage that makes sense, built from the "Từ cần luyện" words: use every one of them you can (at least 80% of them), each spelled exactly as given (same letters and marks).',
      'Short, simple sentences are fine. Aim for 40 to 80 words; it may be longer to use the words, but never over 120 words.',
      'You may add the "Từ gợi ý" words and any small linking words to make the sentences natural.',
      'Answer with the passage only: no title, no explanation, no list, no Markdown, no quotation marks.'
    ].join('\n'),
    en: [
      'You write typing lessons for Vietnamese learners who type in English.',
      'Write ONE English passage that makes sense, built from the "Practice words": use every one of them you can (at least 80% of them), each spelled exactly as given.',
      'Keep their capital letters and the punctuation inside them (don\'t, Lan\'s, well-known); a comma or a full stop after a word may change to fit the sentence.',
      'Short, simple sentences are fine. Aim for 40 to 80 words; it may be longer to use the words, but never over 120 words.',
      'You may add the "Suggested words" and any small linking words to make the sentences natural.',
      'Use only the characters of a keyboard: straight quotes and apostrophes, no emoji.',
      'Answer with the passage only: no title, no explanation, no list, no Markdown, no quotation marks around it.'
    ].join('\n')
  } satisfies Record<TypingLanguage, string>,
  /** The names of the two lines of the prompt (`lessonPrompt`), in the language of the lesson, as the system prompts call them. */
  promptLabels: {
    vi: { practice: 'Từ cần luyện', hints: 'Từ gợi ý' },
    en: { practice: 'Practice words', hints: 'Suggested words' }
  } satisfies Record<TypingLanguage, { practice: string; hints: string }>,
  /** Enough for a passage of 200 Vietnamese words. */
  maxOutputTokens: 1024,
  /** A slower answer is dropped: the lesson is the word list. */
  timeoutMs: 8000,
  /** Passages the AI wrote are kept for others (`AiLessonCache`, SCRUM-153): this many days... */
  cacheDays: 7,
  /** ...and at most this many for each language and set of error types. */
  cachePerKey: 5,
  /** The passage the AI wrote is used only with this many words or fewer... */
  maxWords: 200,
  /** ...and at least this many, so the session can still count (`MIN_COUNTED_WORDS`)... */
  minWords: 20,
  /** ...and when it uses at least this share (%) of the practice words it was given. */
  minUsedPercent: 60
};
