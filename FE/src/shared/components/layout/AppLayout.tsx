import type { ComponentType } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import type { NavItem } from '@/app/module.types';
import { BrandFooter } from '@/shared/components/layout/BrandFooter';
import { BrandHeader } from '@/shared/components/layout/BrandHeader';
import { UserMenu } from '@/shared/components/layout/UserMenu';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { cn } from '@/shared/lib/utils';

interface AppLayoutProps {
  navItems: NavItem[];
  /** Floating components from the module registry (e.g. the chat button). */
  widgets?: ComponentType[];
}

export const AppLayout = ({ navItems: allNavItems, widgets = [] }: AppLayoutProps) => {
  // An expired or rejected token answers 401, which the http interceptor turns
  // into a redirect to /logout. Other failures (server down) keep the user signed in.
  const { data: user } = useCurrentUser();
  const location = useLocation();

  const navItems = allNavItems.filter((item) => !item.roles || (user && item.roles.includes(user.role)));

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-background">
      {/* The same header and footer as the login pages: logo, navigation in the center, then the user menu (Theme, Logout). */}
      <div className="sticky top-0 z-50 bg-background/75 backdrop-blur-xs">
        <BrandHeader
          themeToggle={false}
          nav={
            <nav className="flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 text-base transition-colors',
                    location.pathname === item.to
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <item.icon className="size-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              ))}
            </nav>
          }
        >
          <UserMenu user={user} />
        </BrandHeader>
      </div>

      {/* At least one screen tall below the header (about 61px), so the footer is only seen after scrolling down. */}
      <main className="mx-auto flex min-h-[calc(100vh-61px)] w-full max-w-7xl flex-col px-4 py-8">
        <Outlet />
      </main>

      <BrandFooter />

      {widgets.map((Widget, index) => (
        <Widget key={index} />
      ))}
    </div>
  );
};
