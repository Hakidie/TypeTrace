import { z } from 'zod';

const planConfigSchema = z.object({
  priceVnd: z.number().int('Use a whole number').min(0, 'At least 0'),
  maxPassages: z.number().int('Use a whole number').min(0, 'At least 0'),
  canCreateErrorPractice: z.boolean(),
  canUsePublicPassages: z.boolean()
});

/** The body that saves the plans (and previews the save): both plans, always all their fields. */
export const updatePlansSchema = z.object({
  free: planConfigSchema,
  premium: planConfigSchema
});

export type UpdatePlansInput = z.infer<typeof updatePlansSchema>;

/** Most months one grant may add. */
export const MAX_GRANT_MONTHS = 36;

/** `POST /api/admin/users/:id/premium`: whole months, 1 to 36. */
export const grantPremiumSchema = z.object({
  months: z.number().int('Use a whole number').min(1, 'At least 1 month').max(MAX_GRANT_MONTHS, `At most ${MAX_GRANT_MONTHS} months`)
});

export type GrantPremiumInput = z.infer<typeof grantPremiumSchema>;
