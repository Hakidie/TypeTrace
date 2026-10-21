import { z } from 'zod';
import { THEME_MODES } from '../models/theme.model';
import { contrastProblems, THEME_COLOR_FIELDS } from '../utils/theme-colors';
import { objectIdSchema, optionalBooleanQuerySchema } from './common.validator';

const nameSchema = z.string().trim().min(1, 'Theme name is required').max(30, 'At most 30 characters');

const colorSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^#[0-9a-f]{6}$/, 'Use a color like #1a2b3c');

const colorsShape = Object.fromEntries(THEME_COLOR_FIELDS.map((field) => [field, colorSchema])) as Record<
  (typeof THEME_COLOR_FIELDS)[number],
  typeof colorSchema
>;

/** The four colors; each one that is hard to read on the background is reported on its own field. */
export const themeColorsSchema = z.object(colorsShape).superRefine((colors, ctx) => {
  for (const { field, message } of contrastProblems(colors)) ctx.addIssue({ code: 'custom', message, path: [field] });
});

export const createThemeSchema = z.object({
  name: nameSchema,
  colors: themeColorsSchema
});

export const updateThemeSchema = z
  .object({ name: nameSchema, colors: themeColorsSchema })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Send at least one field to update');

export const listThemesQuerySchema = z.object({
  /** Only the themes of one mode: `true` = dark themes, `false` = light themes. */
  isDark: optionalBooleanQuerySchema
});

/** `null` puts the fallback of that mode back (Blood red for dark, Sand for light). */
export const updateActiveThemesSchema = z
  .object({
    mode: z.enum(THEME_MODES),
    darkTheme: objectIdSchema.nullable(),
    lightTheme: objectIdSchema.nullable()
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Send at least one field to update');

export type CreateThemeInput = z.infer<typeof createThemeSchema>;
export type UpdateThemeInput = z.infer<typeof updateThemeSchema>;
export type ListThemesQuery = z.infer<typeof listThemesQuerySchema>;
export type UpdateActiveThemesInput = z.infer<typeof updateActiveThemesSchema>;
