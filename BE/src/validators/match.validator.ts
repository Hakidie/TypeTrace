import { z } from 'zod';
import { matchKinds } from '../models/match.model';
import { MAX_PASSAGE_WORDS } from '../models/passage.model';

/** A room code as typed: any case, upper-cased here; 6 characters of the room alphabet (no 0, O, 1 or I). */
export const matchCodeParamsSchema = z.object({
  code: z
    .string()
    .trim()
    .transform((code) => code.toUpperCase())
    .pipe(z.string().regex(/^[A-HJ-NP-Z2-9]{6}$/, 'Room codes have 6 letters and digits'))
});

export const readySchema = z.object({ ready: z.boolean() });

/**
 * Everything typed so far (sent again each time, so a lost request does no harm) with the time of each word in ms from
 * the start, and `done` once the last word is typed.
 */
export const progressSchema = z
  .object({
    typedWords: z.array(z.string().max(60)).max(MAX_PASSAGE_WORDS),
    typedAtMs: z.array(z.number().int().min(0)).max(MAX_PASSAGE_WORDS),
    done: z.boolean().default(false)
  })
  .refine((body) => body.typedWords.length === body.typedAtMs.length, 'Send one time per word');

export type ProgressInput = z.infer<typeof progressSchema>;

/** A new room is a race unless it says otherwise; no body at all (older pages send none) is a race too. */
export const createMatchSchema = z.object({ kind: z.enum(matchKinds).default('race') }).default({ kind: 'race' });

/** One word typed in a rain duel, sent on space or Enter. */
export const rainWordSchema = z.object({ text: z.string().trim().min(1).max(40) });

export type CreateMatchInput = z.infer<typeof createMatchSchema>;
export type RainWordInput = z.infer<typeof rainWordSchema>;
