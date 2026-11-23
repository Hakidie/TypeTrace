import { z } from 'zod';
import { MAX_AI_LESSONS_PER_DAY, MAX_AI_LESSONS_PER_MINUTE, MIN_AI_LESSONS_PER_MINUTE } from '../models/app-setting.model';

/** `PUT /api/admin/ai/settings`: every AI setting, always all of them. */
export const aiSettingsSchema = z.object({
  lessonsPerDay: z
    .number()
    .int('Use a whole number')
    .min(0, 'At least 0')
    .max(MAX_AI_LESSONS_PER_DAY, `At most ${MAX_AI_LESSONS_PER_DAY}`),
  lessonsPerMinute: z
    .number()
    .int('Use a whole number')
    .min(MIN_AI_LESSONS_PER_MINUTE, `At least ${MIN_AI_LESSONS_PER_MINUTE}`)
    .max(MAX_AI_LESSONS_PER_MINUTE, `At most ${MAX_AI_LESSONS_PER_MINUTE}`)
});

export type AiSettingsInput = z.infer<typeof aiSettingsSchema>;
