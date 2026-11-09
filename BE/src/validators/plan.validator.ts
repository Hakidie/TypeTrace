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
