import type { ThemeColors, ThemeMode } from '@/shared/lib/theme';

/** A theme as the backend sends it (`BE/src/models/theme.model.ts`). Published themes are TypeTrace's; the others are the user's own. */
export interface Theme {
  _id: string;
  name: string;
  colors: ThemeColors;
  /** Which mode the theme belongs to. */
  isDark: boolean;
  ownerName: string;
  published: boolean;
}

export interface ThemeInput {
  name: string;
  colors: ThemeColors;
}

/** The mode in use and the theme chosen for each mode (`null` = the built-in palette of that mode). */
export interface ActiveThemes {
  mode: ThemeMode;
  dark: Theme | null;
  light: Theme | null;
}

/** Ids, or `null` to go back to the built-in palette. Only the fields sent are changed. */
export interface ActiveThemesInput {
  mode?: ThemeMode;
  darkTheme?: string | null;
  lightTheme?: string | null;
}
