import { z } from 'zod';
import { CHART_RANGES } from '../services/monthly-progress.service';
import { isValidTimeZone } from '../utils/local-date';
import { typingLanguages } from '../utils/typing-language';
import { languageQuerySchema } from './common.validator';

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(100).optional(),
  bio: z.string().trim().max(200).optional(),
  phone: z.string().trim().min(7).max(20).optional()
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const updateSecuritySchema = z.object({
  loginOtpEnabled: z.boolean()
});

export type UpdateSecurityInput = z.infer<typeof updateSecuritySchema>;

/**
 * `PATCH /api/profile/settings`, one setting or both:
 * - `timezone` (SCRUM-31): the browser's time zone, an IANA name `Intl` knows, saved as the browser wrote it (trimmed). Not
 *   under the name this server's `Intl` gives it: Node 24 answers `Asia/Saigon` for `Asia/Ho_Chi_Minh`, and a browser that
 *   keeps its own name would see another zone and send it again on every page load.
 * - `typingLanguage` (SCRUM-219): the language the learner types in Practice.
 * Other fields are dropped, so the theme settings cannot be changed here.
 */
export const updateSettingsSchema = z
  .object({
    timezone: z
      .string()
      .trim()
      .min(1, 'Time zone is required')
      .max(64, 'At most 64 characters')
      .refine(isValidTimeZone, 'Unknown time zone')
      .optional(),
    typingLanguage: z.enum(typingLanguages).optional()
  })
  // Nothing to save: the error goes to `timezone`, the setting the browser sends on its own.
  .refine((settings) => settings.timezone !== undefined || settings.typingLanguage !== undefined, {
    message: 'Send a time zone or a typing language',
    path: ['timezone']
  });

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

/** `{ avatarSource }`: show the uploaded picture or the pixel avatar. */
export const updateAvatarSourceSchema = z.object({
  avatarSource: z.enum(['picture', 'pixel'])
});

export type UpdateAvatarSourceInput = z.infer<typeof updateAvatarSourceSchema>;

/** `GET /api/profile/monthly-progress` (SCRUM-240): what a point of the chart covers; a year (12 months) when missing. */
export const monthlyProgressQuerySchema = languageQuerySchema.extend({
  range: z.enum(CHART_RANGES).default('year'),
  /** A day ('YYYY-MM-DD') in the learner's zone: the chart shows the year, month or week that holds it. Without it the range ends now. */
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((value) => new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value, 'Not a real day')
    .optional()
});

export type MonthlyProgressQuery = z.infer<typeof monthlyProgressQuerySchema>;
