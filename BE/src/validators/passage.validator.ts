import { z } from 'zod';
import { MIN_USER_PASSAGE_WORDS, passageVisibilities, splitWords } from '../models/passage.model';
import { sessionModes } from '../models/typing-session.model';
import { paginationQuerySchema, sortSchema } from '../utils/pagination';
import { cleanPassageText } from '../utils/passage-text';

export const listPassagesQuerySchema = paginationQuerySchema.extend({
  mode: z.enum(sessionModes).default('practice'),
  /** Text searched in the title (`titleSearchPattern`: without accents it finds every accented form). */
  q: z.string().trim().max(100).optional(),
  /** `private` = only the learner's own passages, `public` = only TypeTrace's. Missing = both. */
  visibility: z.enum(passageVisibilities).optional(),
  // By title unless asked otherwise, like the passage menu of the Typing page.
  sort: sortSchema(['title', 'createdAt', 'wordCount'], 'title')
});

/** Pasted text is cleaned first (`cleanPassageText`), so the limits apply to what is saved. */
const cleanText = z.string().transform(cleanPassageText);

/** A learner's own passage. A missing or empty title is made from the first words of the text. */
export const createPassageSchema = z.object({
  title: cleanText.pipe(z.string().max(120, 'At most 120 characters')).optional(),
  content: cleanText.pipe(
    z
      .string()
      .min(1, 'Content is required')
      .max(5000, 'At most 5000 characters')
      .refine((text) => splitWords(text).length >= MIN_USER_PASSAGE_WORDS, `At least ${MIN_USER_PASSAGE_WORDS} words`)
  )
});

export type ListPassagesQuery = z.infer<typeof listPassagesQuerySchema>;
export type CreatePassageInput = z.infer<typeof createPassageSchema>;
