import { z } from 'zod';
import { TUTORIAL_MODES } from '../models/user.model';

/**
 * `PATCH /api/tutorial`: a mode learned or skipped (`{ mode, status }`), the end of the tour (`{ tour }`), or both.
 * The tour only becomes `active` again through `POST /api/tutorial/reset`.
 */
export const updateTutorialSchema = z
  .object({
    mode: z.enum(TUTORIAL_MODES).optional(),
    status: z.enum(['done', 'skipped']).optional(),
    tour: z.enum(['done', 'skipped']).optional()
  })
  .refine((body) => (body.mode === undefined) === (body.status === undefined), {
    message: 'A mode needs a status, a status needs a mode'
  })
  .refine((body) => body.mode !== undefined || body.tour !== undefined, { message: 'Nothing to change' });

export type UpdateTutorialInput = z.infer<typeof updateTutorialSchema>;

/** `POST /api/tutorial/coach`: the numbers of a practice duel. Missed words are lower-case words of the rain (Vietnamese letters too). */
export const coachStatsSchema = z.object({
  result: z.enum(['win', 'loss', 'draw']),
  hits: z.number().int().min(0).max(500),
  thrown: z.number().int().min(0).max(500),
  livesLeft: z.number().int().min(0).max(3),
  seconds: z.number().int().min(0).max(600),
  missedWords: z.array(z.string().regex(/^\p{Ll}{1,20}$/u)).max(10)
});

export type CoachStats = z.infer<typeof coachStatsSchema>;
