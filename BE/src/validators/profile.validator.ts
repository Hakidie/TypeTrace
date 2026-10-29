import { z } from 'zod';
import { isValidTimeZone } from '../utils/local-date';

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
 * `PATCH /api/profile/settings` (SCRUM-31): the browser's time zone, an IANA name `Intl` knows, saved as the browser
 * wrote it (trimmed). Not under the name this server's `Intl` gives it: Node 24 answers `Asia/Saigon` for
 * `Asia/Ho_Chi_Minh`, and a browser that keeps its own name would see another zone and send it again on every page load.
 * Other fields are dropped, so the theme settings cannot be changed here.
 */
export const updateSettingsSchema = z.object({
  timezone: z
    .string()
    .trim()
    .min(1, 'Time zone is required')
    .max(64, 'At most 64 characters')
    .refine(isValidTimeZone, 'Unknown time zone')
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

/** `{ avatarSource }`: show the uploaded picture or the pixel avatar. */
export const updateAvatarSourceSchema = z.object({
  avatarSource: z.enum(['picture', 'pixel'])
});

export type UpdateAvatarSourceInput = z.infer<typeof updateAvatarSourceSchema>;
