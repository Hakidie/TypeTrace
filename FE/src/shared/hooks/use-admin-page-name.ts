import { useTranslation } from 'react-i18next';
import type { NavItem } from '@/app/module.types';

/** The name of an admin page in the language of the interface (`labelKey` in `common`, SCRUM-336), else its English label. */
export const useAdminPageName = () => {
  const { t } = useTranslation();
  return (item: NavItem) => (item.labelKey ? t(item.labelKey) : item.label);
};
