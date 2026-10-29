import { z } from 'zod';
import { MAX_PASSAGE_WORDS, passageLanguages, passageStatuses, passageVisibilities, REVIEW_NOTE_MAX, splitWords } from '../models/passage.model';
import { paginationQuerySchema, sortSchema } from '../utils/pagination';
import { bulkIdsSchema, optionalBooleanQuerySchema } from './common.validator';

const passageFields = {
  title: z.string().trim().min(1, 'Title is required').max(120),
  content: z
    .string()
    .trim()
    .min(1, 'Content is required')
    .max(5000)
    .refine((text) => splitWords(text).length <= MAX_PASSAGE_WORDS, `At most ${MAX_PASSAGE_WORDS} words`),
  source: z.string().trim().min(1, 'Source is required').max(300),
  isPlacement: z.boolean(),
  /** `en` passages are for ranked duels; they can never be placement passages (checked in the service). */
  language: z.enum(passageLanguages)
};

/** A new passage is always a draft: the status cannot be sent here. */
export const createPassageSchema = z.object({
  ...passageFields,
  isPlacement: passageFields.isPlacement.default(false),
  language: passageFields.language.default('vi')
});

export const updatePassageSchema = z
  .object(passageFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Send at least one field to update');

export const setPassageStatusSchema = z.object({ status: z.enum(passageStatuses) });

export const listPassagesQuerySchema = paginationQuerySchema.extend({
  /** Text searched in title and source. */
  q: z.string().trim().max(100).optional(),
  /** `pending` = the review queue: learners' passages waiting to become public (SCRUM-176). */
  status: z.enum(passageStatuses).optional(),
  /** `public` = the passage bank (TypeTrace's and the approved ones), without the learners' private passages. */
  visibility: z.enum(passageVisibilities).optional(),
  isPlacement: optionalBooleanQuerySchema,
  language: z.enum(passageLanguages).optional(),
  /** With `status=pending`: `true` = only the learners' edits of public passages, `false` = only the requests to make a passage public. */
  edited: optionalBooleanQuerySchema,
  sort: sortSchema(['createdAt', 'updatedAt', 'title', 'wordCount'])
});

/** Why a request to make a passage public is turned down: the learner sees it on their passage. */
const reasonSchema = z.string().trim().min(1, 'Give a reason').max(REVIEW_NOTE_MAX, `At most ${REVIEW_NOTE_MAX} characters`);

export const rejectPassageSchema = z.object({ reason: reasonSchema });

/** `{ ids, reason }`: the same reason for every passage turned down. */
export const bulkRejectPassagesSchema = bulkIdsSchema.extend({ reason: reasonSchema });

export type CreatePassageInput = z.infer<typeof createPassageSchema>;
export type UpdatePassageInput = z.infer<typeof updatePassageSchema>;
export type SetPassageStatusInput = z.infer<typeof setPassageStatusSchema>;
export type ListPassagesQuery = z.infer<typeof listPassagesQuerySchema>;
export type RejectPassageInput = z.infer<typeof rejectPassageSchema>;
export type BulkRejectPassagesInput = z.infer<typeof bulkRejectPassagesSchema>;
