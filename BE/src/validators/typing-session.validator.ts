import { z } from 'zod';
import { sessionModes, sessionStatuses } from '../models/typing-session.model';
import { paginationQuerySchema, sortSchema } from '../utils/pagination';
import { objectIdSchema } from './common.validator';

export const createSessionSchema = z.object({
  mode: z.enum(sessionModes).default('practice'),
  /** Missing = a random passage (the placement passage in `placement` mode). */
  passageId: objectIdSchema.optional()
});

/** Only the typed words are trusted: score, WPM and accuracy are always computed by the server. */
export const completeSessionSchema = z.object({
  typedWords: z.array(z.string().max(60)).min(1, 'Send at least one typed word').max(1000)
});

export const listSessionsQuerySchema = paginationQuerySchema.extend({
  sort: sortSchema(['createdAt', 'wpm', 'accuracy']),
  status: z.enum(sessionStatuses).optional()
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type CompleteSessionInput = z.infer<typeof completeSessionSchema>;
export type ListSessionsQuery = z.infer<typeof listSessionsQuerySchema>;
