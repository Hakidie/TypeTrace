import { z } from 'zod';
import { objectIdSchema } from './common.validator';

/** The placement leaderboard (US10.1): one passage and a range, the current week or all the time (Week without one). */
export const placementBoardQuerySchema = z.object({
  passageId: objectIdSchema,
  range: z.enum(['week', 'all']).default('week')
});

export type PlacementBoardQuery = z.infer<typeof placementBoardQuerySchema>;
