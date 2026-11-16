import { useEffect } from 'react';
import { i18n } from '@/shared/i18n/i18n';
import { isUiLanguage, storeUiLanguage } from '@/shared/i18n/ui-language';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';

/**
 * Draws nothing: when the signed-in learner has chosen a language (`settings.uiLanguage`), the interface shows it, also on a
 * browser that chose another one before, and the browser remembers it for the first paint. Without a choice it keeps the
 * one the browser started with (its stored choice, else the browser's language).
 */
export const LanguageSync = () => {
  const { data: user } = useCurrentUser();
  const saved = user?.settings?.uiLanguage;
  useEffect(() => {
    if (!isUiLanguage(saved)) return;
    if (i18n.language !== saved) void i18n.changeLanguage(saved);
    storeUiLanguage(saved);
  }, [saved]);
  return null;
};
