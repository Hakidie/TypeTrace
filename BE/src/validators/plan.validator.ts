import { z } from 'zod';
import { PLAN_IDS } from '../models/subscription.model';
import { paginationQuerySchema, sortSchema } from '../utils/pagination';

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

/** `GET /api/admin/subscriptions`: the plan changes of all users. */
export const listSubscriptionsQuerySchema = paginationQuerySchema.extend({
  /** Text searched in the user's display name and email. */
  q: z.string().trim().max(100).optional(),
  plan: z.enum(PLAN_IDS).optional(),
  /** How it was paid for: `none` is every row that was not a payment. VNPay, MoMo... are added here when US11.2 and US11.3 record the method. */
  method: z.enum(['none']).optional(),
  /** Who made the change: an admin, or the system (sign-up, expiry, a payment, the migration script). */
  by: z.enum(['admin', 'system']).optional(),
  sort: sortSchema(['createdAt', 'startsAt', 'expiresAt'])
});

export type ListSubscriptionsQuery = z.infer<typeof listSubscriptionsQuerySchema>;
