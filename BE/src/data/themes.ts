// Starter themes for everyone (SCRUM-163). Blood red (dark) and Sand (light) are the built-in fallbacks in
// `FE/src/index.css`, so they are not listed here. Add themes here and run `npm run import:themes`: themes already in the
// database (same name) are left untouched. Colors are [background, text, muted text, accent]; they must be readable
// (see `contrastProblems` in utils/theme-colors.ts), and whether a theme is dark or light follows its background.
import { ThemeColors } from '../utils/theme-colors';

export interface ThemeSeed {
  name: string;
  colors: ThemeColors;
}

const colors = ([background, text, muted, accent]: readonly [string, string, string, string]): ThemeColors => ({
  background,
  text,
  muted,
  accent
});

export const THEME_LIST: readonly ThemeSeed[] = [
  { name: 'Midnight', colors: colors(['#0b1020', '#e6ebff', '#8f9bc9', '#6d8bff']) },
  { name: 'Forest', colors: colors(['#0f1a14', '#e4f1e8', '#8fb59f', '#3fb97a']) },
  { name: 'Ember', colors: colors(['#1a0f08', '#f3e3d3', '#b89a80', '#e8742c']) },
  { name: 'Mono', colors: colors(['#ffffff', '#111111', '#777777', '#555555']) },
  { name: 'Paper', colors: colors(['#fbf8f1', '#26231f', '#6b655a', '#1f6f78']) }
];
