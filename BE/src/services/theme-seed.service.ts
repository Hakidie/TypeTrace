import { ThemeSeed } from '../data/themes';
import { THEME_OWNER_NAME, ThemeModel } from '../models/theme.model';
import { badRequest } from '../utils/app-error';
import { contrastProblems, isDarkBackground } from '../utils/theme-colors';

export interface ThemeSeedResult {
  /** Themes that were not in the database and are now. */
  added: number;
  /** Themes already in the database (left untouched). */
  skipped: number;
}

/**
 * Adds themes as TypeTrace's own, published for everyone. Safe to run many times: a published theme with the same
 * name is not touched, so an edit survives. Every theme must be readable.
 */
export const seedThemes = async (list: readonly ThemeSeed[]): Promise<ThemeSeedResult> => {
  for (const theme of list) {
    const [problem] = contrastProblems(theme.colors);
    if (problem) throw badRequest(`Theme "${theme.name}": ${problem.message}`);
  }

  let added = 0;
  for (const theme of list) {
    if (await ThemeModel.exists({ published: true, nameLower: theme.name.toLowerCase() })) continue;
    // Seeded themes have no owner; they are published at once.
    await ThemeModel.create({
      ...theme,
      isDark: isDarkBackground(theme.colors.background),
      ownerName: THEME_OWNER_NAME,
      published: true
    });
    added += 1;
  }
  return { added, skipped: list.length - added };
};
