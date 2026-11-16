// The language of the interface (SCRUM-327, US8.3). Not the language a learner types in (`typing-language.ts`).
// Frontend copy of `uiLanguages` in BE/src/utils/typing-language.ts.
export const uiLanguages = ['vi', 'en'] as const;
export type UiLanguage = (typeof uiLanguages)[number];

export const DEFAULT_UI_LANGUAGE: UiLanguage = 'en';

/** The key of the choice in `localStorage`: a guest's, and the signed-in learner's last one, read before the first paint. */
export const UI_LANGUAGE_KEY = 'typetrace.uiLanguage';

export const isUiLanguage = (value: unknown): value is UiLanguage => uiLanguages.some((language) => language === value);

/** Vietnamese when the browser's language is `vi` (`vi`, `vi-VN`), English otherwise. */
export const languageOfBrowser = (browserLanguage: string | undefined): UiLanguage =>
  browserLanguage?.toLowerCase().split('-')[0] === 'vi' ? 'vi' : 'en';

/** The language this browser chose last, if any. Storage may be blocked: then nothing was chosen. */
export const readStoredUiLanguage = (): UiLanguage | null => {
  try {
    const stored = window.localStorage.getItem(UI_LANGUAGE_KEY);
    return isUiLanguage(stored) ? stored : null;
  } catch {
    return null;
  }
};

export const storeUiLanguage = (language: UiLanguage) => {
  try {
    window.localStorage.setItem(UI_LANGUAGE_KEY, language);
  } catch {
    // The choice then lasts until the page closes.
  }
};

/** What the page starts in: the choice kept in this browser, else the browser's own language. */
export const initialUiLanguage = (): UiLanguage =>
  readStoredUiLanguage() ?? languageOfBrowser(typeof navigator === 'undefined' ? undefined : navigator.language);
