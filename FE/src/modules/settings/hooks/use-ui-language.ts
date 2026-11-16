import { useTranslation } from 'react-i18next';
import { i18n } from '@/shared/i18n/i18n';
import { isUiLanguage, storeUiLanguage, type UiLanguage } from '@/shared/i18n/ui-language';
import { useSaveUiLanguage } from './use-settings';
import { tokenStore } from '@/modules/auth/store/token.store';

/** The language of the interface now (SCRUM-327): it re-renders the caller when it changes. */
export const useUiLanguage = (): UiLanguage => {
  const { i18n: instance } = useTranslation();
  return isUiLanguage(instance.language) ? instance.language : 'en';
};

/** Shows the language at once and keeps it: in this browser always, and in the account when someone is signed in (a guest only has the browser). */
export const useChangeUiLanguage = () => {
  const save = useSaveUiLanguage();
  return (language: UiLanguage) => {
    void i18n.changeLanguage(language);
    storeUiLanguage(language);
    if (tokenStore.get()) save.mutate(language);
  };
};
