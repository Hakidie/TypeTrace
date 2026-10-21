// The look of the whole app is 4 colors (see `index.css`): background, text, muted text and accent. A theme sets them
// inline on <html>; with no theme, the built-in palette of the mode (Blood red for dark, Sand for light) shows.

export type ThemeMode = 'dark' | 'light';

export interface ThemeColors {
  background: string;
  text: string;
  muted: string;
  accent: string;
}

export type ThemeColorField = keyof ThemeColors;

/** Raw hex on purpose: theme colors are chosen by users, so they are data, not theme tokens. */
export const fallbackThemes: Record<ThemeMode, { name: string; colors: ThemeColors }> = {
  dark: { name: 'Blood red', colors: { background: '#140606', text: '#e6d2d2', muted: '#a87878', accent: '#b82121' } },
  light: { name: 'Sand', colors: { background: '#f4ead8', text: '#3a2f20', muted: '#8a7358', accent: '#b4631a' } },
};

const fields = ['background', 'text', 'muted', 'accent'] as const;

const variables: Record<ThemeColorField, string> = {
  background: '--theme-background',
  text: '--theme-text',
  muted: '--theme-muted',
  accent: '--theme-accent',
};

const storageKey = 'theme-state';

const hex = /^#[0-9a-fA-F]{6}$/;

interface StoredTheme {
  mode: ThemeMode;
  /** `null` = the built-in palette of the mode. */
  colors: ThemeColors | null;
}

/** Shows the mode and colors on the page only (nothing is saved): used for the live preview of the theme editor. */
export const paintTheme = (mode: ThemeMode, colors: ThemeColors | null) => {
  const root = document.documentElement;
  root.classList.toggle('dark', mode === 'dark');
  for (const field of fields) {
    if (colors) root.style.setProperty(variables[field], colors[field]);
    else root.style.removeProperty(variables[field]);
  }
};

/** What was applied last time. It is only a cache so the first paint has the right colors; the server is the source of truth. */
export const getStoredTheme = (): StoredTheme => {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? '') as Partial<StoredTheme> | null;
    const colors = stored?.colors;
    const valid = colors && fields.every((field) => typeof colors[field] === 'string' && hex.test(colors[field]));
    return { mode: stored?.mode === 'light' ? 'light' : 'dark', colors: valid ? colors : null };
  } catch {
    return { mode: 'dark', colors: null };
  }
};

/** Shows the mode and colors and remembers them in the browser. */
export const applyTheme = (mode: ThemeMode, colors: ThemeColors | null) => {
  paintTheme(mode, colors);
  try {
    localStorage.setItem(storageKey, JSON.stringify({ mode, colors }));
  } catch {
    // Storage is blocked (private window): the theme still works until the page is closed.
  }
};

/** Applies what was remembered, before the first render. */
export const applyStoredTheme = () => {
  const { mode, colors } = getStoredTheme();
  paintTheme(mode, colors);
};

/** Forgets the theme colors (on logout) so the next person sees the built-in palette. The mode is kept. */
export const clearAppliedTheme = () => applyTheme(getStoredTheme().mode, null);

/** The 4 colors the app shows right now, read from the `--theme-*` variables. */
export const readCurrentColors = (mode: ThemeMode): ThemeColors => {
  const style = getComputedStyle(document.documentElement);
  const read = (field: ThemeColorField) => {
    const value = style.getPropertyValue(variables[field]).trim();
    return hex.test(value) ? value : fallbackThemes[mode].colors[field];
  };
  return { background: read('background'), text: read('text'), muted: read('muted'), accent: read('accent') };
};
