import { z } from 'zod';
import { passageStatuses } from '../models/passage.model';
import { paginationQuerySchema, sortSchema } from '../utils/pagination';
import { optionalBooleanQuerySchema } from './common.validator';

const passageFields = {
  title: z.string().trim().min(1, 'Title is required').max(120),
  content: z.string().trim().min(1, 'Content is required').max(5000),
  source: z.string().trim().min(1, 'Source is required').max(300),
  isPlacement: z.boolean()
};

/** A new passage is always a draft: the status cannot be sent here. */
export const createPassageSchema = z.object({ ...passageFields, isPlacement: passageFields.isPlacement.default(false) });

export const updatePassageSchema = z
  .object(passageFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Send at least one field to update');

export const setPassageStatusSchema = z.object({ status: z.enum(passageStatuses) });

export const listPassagesQuerySchema = paginationQuerySchema.extend({
  /** Text searched in title and source. */
  q: z.string().trim().max(100).optional(),
  status: z.enum(passageStatuses).optional(),
  isPlacement: optionalBooleanQuerySchema,
  sort: sortSchema(['createdAt', 'updatedAt', 'title', 'wordCount'])
});

export type CreatePassageInput = z.infer<typeof createPassageSchema>;
export type UpdatePassageInput = z.infer<typeof updatePassageSchema>;
export type SetPassageStatusInput = z.infer<typeof setPassageStatusSchema>;
export type ListPassagesQuery = z.infer<typeof listPassagesQuerySchema>;
