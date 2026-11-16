import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { settingsEn, settingsVi } from '@/modules/settings/locales';
import { commonEn, commonVi } from './common';
import { DEFAULT_UI_LANGUAGE, initialUiLanguage } from './ui-language';

/**
 * One namespace per module, its strings in `modules/<feature>/locales/{en,vi}.ts`, registered here. A key missing in Vietnamese
 * falls back to English (`fallbackLng`), so an untranslated string never shows its key.
 */
export const resources = {
  en: { common: commonEn, settings: settingsEn },
  vi: { common: commonVi, settings: settingsVi },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: initialUiLanguage(),
  fallbackLng: DEFAULT_UI_LANGUAGE,
  defaultNS: 'common',
  ns: Object.keys(resources.en),
  interpolation: { escapeValue: false }, // React escapes.
  returnNull: false,
  react: { useSuspense: false },
  initAsync: false,
});

const setHtmlLang = (language: string) => {
  document.documentElement.lang = language;
};
setHtmlLang(i18n.language);
i18n.on('languageChanged', setHtmlLang);

export { i18n };
