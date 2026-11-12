import { z } from 'zod';
import { typingLanguages } from '../utils/typing-language';

/** A MongoDB ObjectId as a 24-character hex string. */
export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

/** `/:id` route params. Use with `validate({ params: idParamsSchema })`. */
export const idParamsSchema = z.object({ id: objectIdSchema });

/** Query flag that arrives as the string `'true'` or `'false'`. */
export const booleanQuerySchema = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => value === 'true');

/** Optional filter flag: `'true'` → true, `'false'` → false, missing → no filter. */
export const optionalBooleanQuerySchema = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === 'true'));

/** `{ ids: [...] }` body for bulk actions (at most 100 ids at once). */
export const bulkIdsSchema = z.object({
  ids: z.array(objectIdSchema).min(1, 'Select at least one item').max(100, 'At most 100 items at once')
});

/**
 * `?language=` of a learner's stats (SCRUM-219): the sessions typed in that language. Missing = the language they type in
 * Practice (`settings.typingLanguage`).
 */
export const languageQuerySchema = z.object({ language: z.enum(typingLanguages).optional() });

export type LanguageQuery = z.infer<typeof languageQuerySchema>;
