import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { adminEn, adminVi } from '@/modules/admin/locales';
import { authEn, authVi } from '@/modules/auth/locales';
import { dailyTasksEn, dailyTasksVi } from '@/modules/daily-tasks/locales';
import { homeEn, homeVi } from '@/modules/home/locales';
import { passagesEn, passagesVi } from '@/modules/passages/locales';
import { chatEn, chatVi } from '@/modules/chat/locales';
import { wardrobeEn, wardrobeVi } from '@/modules/avatar/locales';
import { storeEn, storeVi } from '@/modules/payments/locales';
import { profileEn, profileVi } from '@/modules/profile/locales';
import { progressEn, progressVi } from '@/modules/progress/locales';
import { rainEn, rainVi } from '@/modules/rain/locales';
import { rankedEn, rankedVi } from '@/modules/ranked/locales';
import { typingEn, typingVi } from '@/modules/typing/locales';
import { settingsEn, settingsVi } from '@/modules/settings/locales';
import { commonEn, commonVi } from './common';
import { DEFAULT_UI_LANGUAGE, initialUiLanguage } from './ui-language';

/**
 * One namespace per module, its strings in `modules/<feature>/locales/{en,vi}.ts`, registered here. A key missing in Vietnamese
 * falls back to English (`fallbackLng`), so an untranslated string never shows its key.
 */
export const resources = {
  en: { common: commonEn, settings: settingsEn, auth: authEn, home: homeEn, typing: typingEn, profile: profileEn, progress: progressEn, passages: passagesEn, ranked: rankedEn, rain: rainEn, store: storeEn, wardrobe: wardrobeEn, chat: chatEn, admin: adminEn, dailyTasks: dailyTasksEn },
  vi: { common: commonVi, settings: settingsVi, auth: authVi, home: homeVi, typing: typingVi, profile: profileVi, progress: progressVi, passages: passagesVi, ranked: rankedVi, rain: rainVi, store: storeVi, wardrobe: wardrobeVi, chat: chatVi, admin: adminVi, dailyTasks: dailyTasksVi },
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
