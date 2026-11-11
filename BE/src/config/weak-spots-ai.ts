/**
 * The AI writer of the Weak spots lessons (SCRUM-28, US3.2): it turns the words picked from the word bank into a short
 * passage that makes sense. The server checks what it wrote (`checkAiPassage`); a failed or refused answer leaves the
 * lesson as the list of picked words, and the learner sees no error.
 */
export const weakSpotsAi = {
  systemPrompt: [
    'You write typing lessons for Vietnamese learners.',
    'Write ONE Vietnamese passage that makes sense, built from the "Từ cần luyện" words: use every one of them you can (at least 80% of them), each spelled exactly as given (same letters and marks).',
    'Short, simple sentences are fine. Aim for 40 to 80 words; it may be longer to use the words, but never over 120 words.',
    'You may add the "Từ gợi ý" words and any small linking words to make the sentences natural.',
    'Answer with the passage only: no title, no explanation, no list, no Markdown, no quotation marks.'
  ].join('\n'),
  /** Enough for a passage of 200 Vietnamese words. */
  maxOutputTokens: 1024,
  /** A slower answer is dropped: the lesson is the word list. */
  timeoutMs: 8000,
  /** AI passages a learner may ask for in a minute; past it, the lesson is the word list (no 429). */
  perMinute: 5,
  /** The passage the AI wrote is used only with this many words or fewer... */
  maxWords: 200,
  /** ...and at least this many, so the session can still count (`MIN_COUNTED_WORDS`)... */
  minWords: 20,
  /** ...and when it uses at least this share (%) of the practice words it was given. */
  minUsedPercent: 60
};
