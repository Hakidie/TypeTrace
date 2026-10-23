import { z } from 'zod';
import { MIN_USER_PASSAGE_WORDS, passageVisibilities, splitWords } from '../models/passage.model';
import { sessionModes } from '../models/typing-session.model';
import { paginationQuerySchema, sortSchema } from '../utils/pagination';
import { cleanPassageText } from '../utils/passage-text';
import { optionalBooleanQuerySchema } from './common.validator';

export const listPassagesQuerySchema = paginationQuerySchema.extend({
  mode: z.enum(sessionModes).default('practice'),
  /** Text searched in the title (`titleSearchPattern`: without accents it finds every accented form). */
  q: z.string().trim().max(100).optional(),
  /** `private` = only the learner's own private passages, `public` = only the public ones (TypeTrace's and approved ones). Missing = both. */
  visibility: z.enum(passageVisibilities).optional(),
  /** `true` = only the learner's own passages (private or approved, the Passages page), `false` = only the others. Missing = both. */
  mine: optionalBooleanQuerySchema,
  // By title unless asked otherwise, like the passage menu of the Typing page.
  sort: sortSchema(['title', 'createdAt', 'wordCount'], 'title')
});

/** Pasted text is cleaned first (`cleanPassageText`), so the limits apply to what is saved. */
const cleanText = z.string().transform(cleanPassageText);

const titleSchema = cleanText.pipe(z.string().min(1, 'Title is required').max(120, 'At most 120 characters'));

/** Where the text comes from (a book, a website, "my own"): the admins check it before a passage becomes public. */
const sourceSchema = cleanText.pipe(z.string().min(1, 'Source is required').max(300, 'At most 300 characters'));

const contentSchema = cleanText.pipe(
  z
    .string()
    .min(1, 'Content is required')
    .max(5000, 'At most 5000 characters')
    .refine((text) => splitWords(text).length >= MIN_USER_PASSAGE_WORDS, `At least ${MIN_USER_PASSAGE_WORDS} words`)
);

/** A learner's own passage: a title, where the text comes from, and the text. All three are required, also once cleaned. */
export const createPassageSchema = z.object({ title: titleSchema, source: sourceSchema, content: contentSchema });

/** Changes to a learner's own passage, checked like a new one. */
export const updatePassageSchema = z
  .object({ title: titleSchema, source: sourceSchema, content: contentSchema })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Send at least one field to update');

export type ListPassagesQuery = z.infer<typeof listPassagesQuerySchema>;
export type CreatePassageInput = z.infer<typeof createPassageSchema>;
export type UpdatePassageInput = z.infer<typeof updatePassageSchema>;
