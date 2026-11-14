import { type AppFont, appFonts } from '@/shared/lib/app-font';

/** A font a learner can choose for the whole interface (SCRUM-158). */
export interface FontOption {
  id: AppFont;
  label: string;
  /** The CSS `font-family` value: the font, then a generic family for the moment before its files have loaded. */
  stack: string;
  /** Loads the font files (Latin and Vietnamese, regular, semibold and bold), only when the font is chosen. */
  load: () => Promise<unknown>;
}

export const FONT_OPTIONS: FontOption[] = [
  {
    id: 'inter',
    label: 'Inter',
    stack: "'Inter', Arial, sans-serif",
    load: () =>
      Promise.all([
        import('@fontsource/inter/latin-400.css'),
        import('@fontsource/inter/latin-600.css'),
        import('@fontsource/inter/latin-700.css'),
        import('@fontsource/inter/vietnamese-400.css'),
        import('@fontsource/inter/vietnamese-600.css'),
        import('@fontsource/inter/vietnamese-700.css'),
      ]),
  },
  {
    id: 'be-vietnam-pro',
    label: 'Be Vietnam Pro',
    stack: "'Be Vietnam Pro', Arial, sans-serif",
    load: () =>
      Promise.all([
        import('@fontsource/be-vietnam-pro/latin-400.css'),
        import('@fontsource/be-vietnam-pro/latin-600.css'),
        import('@fontsource/be-vietnam-pro/latin-700.css'),
        import('@fontsource/be-vietnam-pro/vietnamese-400.css'),
        import('@fontsource/be-vietnam-pro/vietnamese-600.css'),
        import('@fontsource/be-vietnam-pro/vietnamese-700.css'),
      ]),
  },
  {
    id: 'lexend',
    label: 'Lexend',
    stack: "'Lexend', Arial, sans-serif",
    load: () =>
      Promise.all([
        import('@fontsource/lexend/latin-400.css'),
        import('@fontsource/lexend/latin-600.css'),
        import('@fontsource/lexend/latin-700.css'),
        import('@fontsource/lexend/vietnamese-400.css'),
        import('@fontsource/lexend/vietnamese-600.css'),
        import('@fontsource/lexend/vietnamese-700.css'),
      ]),
  },
  {
    id: 'noto-serif',
    label: 'Noto Serif',
    stack: "'Noto Serif', Georgia, serif",
    load: () =>
      Promise.all([
        import('@fontsource/noto-serif/latin-400.css'),
        import('@fontsource/noto-serif/latin-600.css'),
        import('@fontsource/noto-serif/latin-700.css'),
        import('@fontsource/noto-serif/vietnamese-400.css'),
        import('@fontsource/noto-serif/vietnamese-600.css'),
        import('@fontsource/noto-serif/vietnamese-700.css'),
      ]),
  },
  {
    id: 'jetbrains-mono',
    label: 'JetBrains Mono',
    stack: "'JetBrains Mono', 'Courier New', monospace",
    load: () =>
      Promise.all([
        import('@fontsource/jetbrains-mono/latin-400.css'),
        import('@fontsource/jetbrains-mono/latin-600.css'),
        import('@fontsource/jetbrains-mono/latin-700.css'),
        import('@fontsource/jetbrains-mono/vietnamese-400.css'),
        import('@fontsource/jetbrains-mono/vietnamese-600.css'),
        import('@fontsource/jetbrains-mono/vietnamese-700.css'),
      ]),
  },
];

const STORAGE_KEY = 'typetrace-font';

const optionOf = (id: AppFont) => FONT_OPTIONS.find((option) => option.id === id) ?? FONT_OPTIONS[0];

/**
 * Puts the font on the whole page: `--app-font` on `<html>` (read by `body` in `index.css`) is set at once, so the page uses the
 * font's stack while its files load. A file that fails to load (offline) is dropped: the stack's fallback stays.
 */
export const applyFont = async (id: AppFont): Promise<void> => {
  const option = optionOf(id);
  document.documentElement.style.setProperty('--app-font', option.stack);
  try {
    await option.load();
  } catch {
    // The generic family of the stack is shown instead.
  }
};

/** The font this browser used last, so a reload or a page without a signed-in user does not flash the old font. Never throws. */
export const readStoredFont = (): AppFont | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return (appFonts as readonly string[]).includes(stored ?? '') ? (stored as AppFont) : null;
  } catch {
    return null;
  }
};

/** Remembers the font in this browser only (a per-viewer convenience: the account keeps the real choice). Never throws. */
export const storeFont = (id: AppFont): void => {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Private window or blocked storage: the page just starts with the default font next time.
  }
};
