import { z } from 'zod';
import { MAX_REPLAY_BYTES } from '../models/session-replay.model';
import { sessionModes, sessionStatuses, startableModes, TIME_LIMIT_CHOICES_SECONDS } from '../models/typing-session.model';
import { paginationQuerySchema, sortSchema } from '../utils/pagination';
import { WordError } from '../utils/vietnamese-errors';
import { objectIdSchema } from './common.validator';

export const createSessionSchema = z
  .object({
    mode: z.enum(startableModes).default('practice'),
    /** Missing = a random passage (the placement passage in `placement` mode). */
    passageId: objectIdSchema.optional(),
    /**
     * The time the learner chose (US10.1), kept by the server as `chosenLimitSeconds` to decide at the end if a placement session goes
     * on the leaderboard. One of the times the page offers. Changing the time starts a new session.
     */
    timeLimitSeconds: z
      .number()
      .refine((seconds) => (TIME_LIMIT_CHOICES_SECONDS as readonly number[]).includes(seconds), 'Choose one of the times offered')
      .optional(),
    /** Weak spots only (`targeted`, US3.2): the one error type to practice. Missing = the learner's types with the highest error rates. */
    errorType: z.enum(WordError).optional()
  })
  .refine((body) => body.mode !== 'targeted' || body.passageId === undefined, {
    message: 'A weak spots lesson picks its own words',
    path: ['passageId']
  })
  .refine((body) => body.mode === 'targeted' || body.errorType === undefined, {
    message: 'Only a weak spots lesson takes an error type',
    path: ['errorType']
  });

const replayNumber = z.number().int().min(0);

/** One change of the typed text: `ReplayEvent` in `session-replay.model.ts`. */
const replayEventSchema = z.union([
  z.tuple([replayNumber, replayNumber, replayNumber, z.string()]),
  z.tuple([replayNumber, replayNumber, replayNumber, z.string(), z.literal(1)])
]);

/** The replay of the session (SCRUM-35): at most `MAX_REPLAY_BYTES` of JSON. */
export const replaySchema = z
  .array(replayEventSchema)
  .min(1)
  .refine((events) => Buffer.byteLength(JSON.stringify(events)) <= MAX_REPLAY_BYTES, 'The replay is too big');

/**
 * Only the typed words (and when each was finished) are trusted: score, WPM and accuracy are always computed by the server.
 * `typedAtMs` is optional (an older page does not send it) but, when sent, has one entry per typed word.
 */
export const completeSessionSchema = z
  .object({
    typedWords: z.array(z.string().max(60)).min(1, 'Send at least one typed word').max(1000),
    typedAtMs: z.array(z.number().int().min(0)).max(1000).optional(),
    /** The time the learner chose, only used to size the time axis of the chart (3 minutes at most, like `MAX_SESSION_MS`). */
    timeLimitSeconds: z.number().int().min(1).max(180).optional(),
    /** Optional. A replay that breaks a rule (too big, not made of changes) is dropped: the session is completed without it. */
    replay: replaySchema.optional().catch(undefined)
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
