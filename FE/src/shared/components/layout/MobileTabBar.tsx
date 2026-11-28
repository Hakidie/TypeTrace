import { useTranslation } from 'react-i18next';
import type { NavItem, NavWidget } from '@/app/module.types';
import { NavLinks } from '@/shared/components/layout/NavLinks';
import { useIsPhone } from '@/shared/hooks/use-is-phone';

/**
 * The phone's navigation: the links of the header as a tab bar fixed to the bottom of the screen (nothing on larger screens, where
 * the header shows them). It sits outside the sticky header: that one blurs what is behind it, which would make a fixed child follow it.
 */
export const MobileTabBar = ({ items, guest = false }: { items: (NavItem | NavWidget)[]; guest?: boolean }) => {
  const { t } = useTranslation();
  const phone = useIsPhone();
  if (!phone) return null;
  return (
    <div aria-label={t('nav.main')} role="region" className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xs">
      <NavLinks items={items} guest={guest} variant="tabs" />
    </div>
  );
};
