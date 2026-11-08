import type { ComponentType } from 'react';
import { Outlet } from 'react-router-dom';
import type { MenuItem, NavItem, NavWidget } from '@/app/module.types';
import { BrandFooter } from '@/shared/components/layout/BrandFooter';
import { BrandHeader } from '@/shared/components/layout/BrandHeader';
import { NavLinks } from '@/shared/components/layout/NavLinks';
import { UserMenu } from '@/shared/components/layout/UserMenu';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { useThemeSync } from '@/modules/settings/hooks/use-theme-mode';

interface AppLayoutProps {
  navItems: (NavItem | NavWidget)[];
  /** Entries of the account menu from the module registry (Settings, AI chat). */
  menuItems?: MenuItem[];
  /** Floating components from the module registry (e.g. the chat button). */
  widgets?: ComponentType[];
}

export const AppLayout = ({ navItems: allNavItems, menuItems = [], widgets = [] }: AppLayoutProps) => {
  // An expired or rejected token answers 401, which the http interceptor turns
  // into a redirect to /logout. Other failures (server down) keep the user signed in.
  const { data: user } = useCurrentUser();
  useThemeSync();

  const navItems = allNavItems.filter((item) => !item.roles || (user && item.roles.includes(user.role)));

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-background">
      {/* The same header and footer as the login pages: logo, navigation in the center, then the user menu (Mode, Logout). */}
      <div className="sticky top-0 z-50 bg-background/75 backdrop-blur-xs">
        <BrandHeader
          themeToggle={false}
          nav={<NavLinks items={navItems} />}
        >
          <UserMenu user={user} menuItems={menuItems} />
        </BrandHeader>
      </div>

      {/* At least one screen tall below the header (about 61px), so the footer is only seen after scrolling down. */}
      <main className="mx-auto flex min-h-[calc(100vh-61px)] w-full max-w-7xl flex-col px-4 pb-8 pt-12">
        <Outlet />
      </main>

      <BrandFooter />

      {widgets.map((Widget, index) => (
        <Widget key={index} />
      ))}
    </div>
  );
};
