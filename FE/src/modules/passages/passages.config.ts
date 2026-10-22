// Limits of a passage, the same as the backend (`BE/src/models/passage.model.ts` and `passage.validator.ts`).
export const PASSAGE_TITLE_MAX = 120;
export const PASSAGE_CONTENT_MAX = 5000;

/** How many passages of their own a learner may have (`MAX_USER_PASSAGES`). */
export const MAX_OWN_PASSAGES = 20;

/** A learner's own passage needs at least this many words (`MIN_USER_PASSAGE_WORDS`): shorter sessions never count. */
export const MIN_OWN_PASSAGE_WORDS = 20;

/** Same rule as the backend (`splitWords`): words are separated by white space. The backend does the real count. */
export const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length;
