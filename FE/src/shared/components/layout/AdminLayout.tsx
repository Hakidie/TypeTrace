import { Menu, X } from 'lucide-react';
import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation } from 'react-router-dom';
import type { NavItem } from '@/app/module.types';
import { LanguageSync } from '@/modules/settings/components/LanguageSync';
import { useThemeSync } from '@/modules/settings/hooks/use-theme-mode';
import { AdminSidebar } from '@/shared/components/layout/AdminSidebar';
import { useAdminPageName } from '@/shared/hooks/use-admin-page-name';
import { Button } from '@/shared/components/ui/button';
import { i18n } from '@/shared/i18n/i18n';
import { useSidebarMode } from '@/shared/hooks/use-sidebar-mode';
import { cn } from '@/shared/lib/utils';

interface AdminLayoutProps {
  navItems: NavItem[];
}

/**
 * Shell of the admin area: the sidebar (it has its own header and footer; a drawer
 * on small screens) and, next to it, a header with the page title and the page. No BrandHeader or BrandFooter here.
 * In the language of the interface (SCRUM-336): the admin's own choice (`LanguageSync`, as `AppLayout`'s widget does, since
 * an admin lands here after login), and the page is drawn again when it changes, so the label maps it reads follow it.
 */
export const AdminLayout = ({ navItems }: AdminLayoutProps) => {
  const { t } = useTranslation();
  const nameOf = useAdminPageName();
  const [menuOpen, setMenuOpen] = useState(false);
  useThemeSync();
  const { pathname } = useLocation();
  const compact = useSidebarMode().mode === 'compact';
  // Title = name of the nav item for this page, in the language of the interface (the longest matching path wins, so /admin is not every page).
  const page = navItems
    .filter((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0];
  const title = page && nameOf(page);

  return (
    <div className="flex min-h-screen bg-background">
      <LanguageSync />
      {/* Sidebar: fixed full-height column on large screens (icons only when compact; the drawer is always full) */}
      <aside className={cn('hidden shrink-0 border-r bg-background lg:block', compact ? 'w-16' : 'w-60')}>
        <div className="sticky top-0 z-50 h-screen">
          <AdminSidebar navItems={navItems} compact={compact} />
        </div>
      </aside>

      {/* Sidebar: drawer on small screens */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label={t('admin.closeMenu')} className="absolute inset-0 bg-black/50" onClick={() => setMenuOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 border-r bg-background">
            <button
              type="button"
              aria-label={t('admin.closeMenu')}
              className="absolute right-3 top-5 text-muted-foreground hover:text-foreground"
              onClick={() => setMenuOpen(false)}
            >
              <X className="size-5" />
            </button>
            <AdminSidebar navItems={navItems} onNavigate={() => setMenuOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Same height as the sidebar header (61px). */}
        <header className="sticky top-0 z-40 flex h-[61px] shrink-0 items-center gap-2 border-b bg-background/75 px-4 backdrop-blur-xs">
          <Button variant="ghost" size="sm" className="lg:hidden" aria-label={t('admin.openMenu')} onClick={() => setMenuOpen(true)}>
            <Menu className="size-5" />
          </Button>
          <h1 className="truncate text-xl font-bold text-primary">{title}</h1>
        </header>
        {/* A column, so a page can grow to the height of the screen (`flex-1`), like the passage form of /admin/passages. */}
        <main className="flex w-full min-w-0 flex-1 flex-col p-8">
          <Fragment key={i18n.language}>
            <Outlet />
          </Fragment>
        </main>
      </div>
    </div>
  );
};
