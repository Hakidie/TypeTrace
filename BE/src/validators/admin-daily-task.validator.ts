import { z } from 'zod';
import { MAX_DAILY_TASK_COUNT } from '../models/app-setting.model';
import { DAILY_TASK_TYPES } from '../models/daily-task.model';
import { paginationQuerySchema, sortSchema } from '../utils/pagination';
import { WordError } from '../utils/vietnamese-errors';
import { optionalBooleanQuerySchema } from './common.validator';

const dailyTaskFields = {
  title: z.string().trim().min(1, 'Title is required').max(120),
  description: z.string().trim().max(300),
  type: z.enum(DAILY_TASK_TYPES),
  /** The most of each type (`DAILY_TASK_TARGET_MAX`) is checked by the model, against the type the task ends up with. */
  target: z.number().int('Use a whole number').min(1, 'At least 1'),
  /**
   * The error type an accuracy task focuses on (SCRUM-112); `null` takes the focus away. That only accuracy tasks have
   * one is checked by the model, against the type the task ends up with, like the target.
   */
  errorType: z.enum(WordError).nullable(),
  isActive: z.boolean()
};

export const createDailyTaskSchema = z.object({
  ...dailyTaskFields,
  description: dailyTaskFields.description.default(''),
  errorType: dailyTaskFields.errorType.optional(),
  isActive: dailyTaskFields.isActive.default(true)
});

export const updateDailyTaskSchema = z
  .object(dailyTaskFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Send at least one field to update');

export const listDailyTasksQuerySchema = paginationQuerySchema.extend({
  /** Text searched in title and description. */
  q: z.string().trim().max(100).optional(),
  type: z.enum(DAILY_TASK_TYPES).optional(),
  /** `true` = the active tasks, `false` = the inactive ones. */
  isActive: optionalBooleanQuerySchema,
  sort: sortSchema(['createdAt', 'updatedAt', 'title'])
});

/** `PUT /daily-tasks/settings`: every daily task setting, always all of them. */
export const dailyTaskSettingsSchema = z.object({
  dailyTaskCount: z
    .number()
    .int('Use a whole number')
    .min(1, 'At least 1')
    .max(MAX_DAILY_TASK_COUNT, `At most ${MAX_DAILY_TASK_COUNT}`)
});

export type CreateDailyTaskInput = z.infer<typeof createDailyTaskSchema>;
export type UpdateDailyTaskInput = z.infer<typeof updateDailyTaskSchema>;
export type ListDailyTasksQuery = z.infer<typeof listDailyTasksQuerySchema>;
export type DailyTaskSettingsInput = z.infer<typeof dailyTaskSettingsSchema>;
