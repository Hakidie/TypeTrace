import { z } from 'zod';
import { MAX_PLACEMENT_MIN_ACCURACY, MIN_PLACEMENT_MIN_ACCURACY } from '../models/app-setting.model';
import { objectIdSchema } from './common.validator';

/** The placement leaderboard (US10.1): one passage and a range, the current week or all the time (Week without one). */
export const placementBoardQuerySchema = z.object({
  passageId: objectIdSchema,
  range: z.enum(['week', 'all']).default('week')
});

/** `PUT /api/admin/placement/settings`: every placement setting, always all of them. */
export const placementSettingsSchema = z.object({
  minAccuracy: z
    .number()
    .int('Use a whole number')
    .min(MIN_PLACEMENT_MIN_ACCURACY, `At least ${MIN_PLACEMENT_MIN_ACCURACY}`)
    .max(MAX_PLACEMENT_MIN_ACCURACY, `At most ${MAX_PLACEMENT_MIN_ACCURACY}`)
});

export type PlacementSettingsInput = z.infer<typeof placementSettingsSchema>;
export type PlacementBoardQuery = z.infer<typeof placementBoardQuerySchema>;
