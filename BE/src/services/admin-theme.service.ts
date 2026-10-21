import type { QueryFilter } from 'mongoose';
import { THEME_OWNER_NAME, ThemeDocument, ThemeModel } from '../models/theme.model';
import { UserModel } from '../models/user.model';
import { conflict, notFound } from '../utils/app-error';
import { paginate } from '../utils/pagination';
import { isDarkBackground } from '../utils/theme-colors';
import { CreateAdminThemeInput, ListAdminThemesQuery, UpdateAdminThemeInput } from '../validators/admin-theme.validator';
import { wrongMode } from './theme.service';

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isDuplicateKey = (error: unknown) => (error as { code?: number }).code === 11000;

const nameTaken = () => conflict('A TypeTrace theme with this name already exists');

/** The admin manages TypeTrace's themes (the published ones). Learners' private themes are never listed here. */
const published = { published: true };

export const listThemes = ({ q, isDark, sort, ...pagination }: ListAdminThemesQuery) => {
  const filter: QueryFilter<ThemeDocument> = { ...published };
  if (isDark !== undefined) filter.isDark = isDark;
  if (q) filter.nameLower = new RegExp(escapeRegex(q.toLowerCase()));
  // Names are sorted by their lower-case copy, so "apple" and "Apple" sit together.
  return paginate(ThemeModel, filter, { ...pagination, sort: sort.replace(/^(-?)name$/, '$1nameLower') });
};

/** Published for everyone, shown as TypeTrace. Like the seeded themes it has no owner, so names are unique among TypeTrace's themes. */
export const createTheme = async (input: CreateAdminThemeInput) => {
  const isDark = input.mode === 'dark';
  const backgroundIsDark = isDarkBackground(input.colors.background);
  if (backgroundIsDark !== isDark) throw wrongMode(backgroundIsDark);
  if (await ThemeModel.exists({ ...published, nameLower: input.name.toLowerCase() })) throw nameTaken();

  try {
    return await ThemeModel.create({ name: input.name, colors: input.colors, isDark, ownerName: THEME_OWNER_NAME, published: true });
  } catch (error) {
    if (isDuplicateKey(error)) throw nameTaken();
    throw error;
  }
};

export const updateTheme = async (id: string, input: UpdateAdminThemeInput) => {
  const theme = await ThemeModel.findOne({ _id: id, ...published });
  if (!theme) throw notFound('Theme not found');

  if (input.colors) {
    // Recoloring cannot move a theme to the other mode: the users who chose it for a mode would lose it.
    const isDark = isDarkBackground(input.colors.background);
    if (isDark !== theme.isDark) throw wrongMode(isDark);
    theme.colors = input.colors;
  }
  if (input.name !== undefined) {
    if (await ThemeModel.exists({ ...published, nameLower: input.name.toLowerCase(), _id: { $ne: id } })) throw nameTaken();
    theme.name = input.name;
  }

  try {
    return await theme.save();
  } catch (error) {
    if (isDuplicateKey(error)) throw nameTaken();
    throw error;
  }
};

/** Everyone who had chosen the theme goes back to the fallback of that mode. */
export const deleteTheme = async (id: string) => {
  const theme = await ThemeModel.findOneAndDelete({ _id: id, ...published });
  if (!theme) throw notFound('Theme not found');

  await UserModel.updateMany({ 'settings.darkTheme': id }, { $set: { 'settings.darkTheme': null } });
  await UserModel.updateMany({ 'settings.lightTheme': id }, { $set: { 'settings.lightTheme': null } });
};
