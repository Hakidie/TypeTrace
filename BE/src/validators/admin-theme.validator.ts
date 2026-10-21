import { z } from 'zod';
import { THEME_MODES } from '../models/theme.model';
import { paginationQuerySchema, sortSchema } from '../utils/pagination';
import { optionalBooleanQuerySchema } from './common.validator';
import { nameSchema, themeColorsSchema, updateThemeSchema } from './theme.validator';

/** The admin picks the mode; the background of the colors must fit it. */
export const createAdminThemeSchema = z.object({
  name: nameSchema,
  mode: z.enum(THEME_MODES),
  colors: themeColorsSchema
});

/** The mode of a theme never changes: users have chosen it for that mode. */
export const updateAdminThemeSchema = updateThemeSchema;

export const listAdminThemesQuerySchema = paginationQuerySchema.extend({
  /** Text searched in the name. */
  q: z.string().trim().max(100).optional(),
  /** `true` = dark themes, `false` = light themes. */
  isDark: optionalBooleanQuerySchema,
  sort: sortSchema(['createdAt', 'updatedAt', 'name'])
});

export type CreateAdminThemeInput = z.infer<typeof createAdminThemeSchema>;
export type UpdateAdminThemeInput = z.infer<typeof updateAdminThemeSchema>;
export type ListAdminThemesQuery = z.infer<typeof listAdminThemesQuerySchema>;
