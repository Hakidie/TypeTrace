// Limits of a passage, the same as the backend (`BE/src/models/passage.model.ts` and `passage.validator.ts`).
export const PASSAGE_TITLE_MAX = 120;
export const PASSAGE_SOURCE_MAX = 300;
export const PASSAGE_CONTENT_MAX = 5000;

/** How many passages of their own a learner may have (`MAX_USER_PASSAGES`). */
export const MAX_OWN_PASSAGES = 20;

/** A learner's own passage needs at least this many words (`MIN_USER_PASSAGE_WORDS`): shorter sessions never count. */
export const MIN_OWN_PASSAGE_WORDS = 20;

/** No passage may have more words than this (`MAX_PASSAGE_WORDS`), admins and learners alike. */
export const MAX_PASSAGE_WORDS = 200;

/** Longest reason an admin may give when turning down a request to make a passage public (`REVIEW_NOTE_MAX`). */
export const REVIEW_NOTE_MAX = 300;

/** The author shown with a learner's public passage when they have no display name (`ANONYMOUS_OWNER_NAME`): never their email. */
export const ANONYMOUS_OWNER_NAME = 'Anonymous learner';

/** Same rule as the backend (`splitWords`): words are separated by white space. The backend does the real count. */
export const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length;
