import { z } from 'zod';
import { sessionModes, sessionStatuses, startableModes } from '../models/typing-session.model';
import { paginationQuerySchema, sortSchema } from '../utils/pagination';
import { objectIdSchema } from './common.validator';

export const createSessionSchema = z.object({
  mode: z.enum(startableModes).default('practice'),
  /** Missing = a random passage (the placement passage in `placement` mode). */
  passageId: objectIdSchema.optional()
});

/**
 * Only the typed words (and when each was finished) are trusted: score, WPM and accuracy are always computed by the server.
 * `typedAtMs` is optional (an older page does not send it) but, when sent, has one entry per typed word.
 */
export const completeSessionSchema = z
  .object({
    typedWords: z.array(z.string().max(60)).min(1, 'Send at least one typed word').max(1000),
    typedAtMs: z.array(z.number().int().min(0)).max(1000).optional(),
    /** The time the learner chose, only used to size the time axis of the chart (3 minutes at most, like `MAX_SESSION_MS`). */
    timeLimitSeconds: z.number().int().min(1).max(180).optional()
  })
  .refine((body) => !body.typedAtMs || body.typedAtMs.length === body.typedWords.length, {
    message: 'Send one time for each typed word',
    path: ['typedAtMs']
  });

export const listSessionsQuerySchema = paginationQuerySchema.extend({
  sort: sortSchema(['createdAt', 'wpm', 'accuracy']),
  status: z.enum(sessionStatuses).optional(),
  /** Text searched in the passage name (`titleSearchPattern`: without accents it finds every accented form). */
  q: z.string().trim().max(100).optional(),
  mode: z.enum(sessionModes).optional(),
  /** The time the learner chose, in seconds (sessions from before it was stored never match). */
  timeLimitSeconds: z.coerce.number().int().min(1).max(180).optional()
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type CompleteSessionInput = z.infer<typeof completeSessionSchema>;
export type ListSessionsQuery = z.infer<typeof listSessionsQuerySchema>;
