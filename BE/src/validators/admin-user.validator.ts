import { z } from 'zod';
import { USER_ROLES, USER_STATUSES } from '../models/user.model';
import { paginationQuerySchema, sortSchema } from '../utils/pagination';
import { optionalBooleanQuerySchema } from './common.validator';

export const listUsersQuerySchema = paginationQuerySchema.extend({
  /** Text searched in email and display name. */
  q: z.string().trim().max(100).optional(),
  role: z.enum(USER_ROLES).optional(),
  verified: optionalBooleanQuerySchema,
  status: z.enum(USER_STATUSES).optional(),
  sort: sortSchema(['createdAt', 'email', 'displayName', 'role'])
});

export const adminUpdateUserSchema = z
  .object({
    displayName: z.string().trim().min(1).max(100),
    role: z.enum(USER_ROLES),
    isEmailVerified: z.boolean(),
    loginOtpEnabled: z.boolean()
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Send at least one field to update');

export const setUserStatusSchema = z.object({ status: z.enum(USER_STATUSES) });

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;
export type SetUserStatusInput = z.infer<typeof setUserStatusSchema>;
