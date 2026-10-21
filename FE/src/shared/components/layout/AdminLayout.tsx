import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import type { NavItem } from '@/app/module.types';
import { useThemeSync } from '@/modules/settings/hooks/use-theme-mode';
import { AdminSidebar } from '@/shared/components/layout/AdminSidebar';
import { Button } from '@/shared/components/ui/button';
import { useSidebarMode } from '@/shared/hooks/use-sidebar-mode';
import { cn } from '@/shared/lib/utils';

interface AdminLayoutProps {
  navItems: NavItem[];
}

/**
 * Shell of the admin area: the sidebar (it has its own header and footer; a drawer
 * on small screens) and, next to it, a header with the page title and the page. No BrandHeader or BrandFooter here.
 */
export const AdminLayout = ({ navItems }: AdminLayoutProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  useThemeSync();
  const { pathname } = useLocation();
  const compact = useSidebarMode().mode === 'compact';
  // Title = label of the nav item for this page (the longest matching path wins, so /admin is not every page).
  const title = navItems
    .filter((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0]?.label;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar: fixed full-height column on large screens (icons only when compact; the drawer is always full) */}
      <aside className={cn('hidden shrink-0 border-r bg-background lg:block', compact ? 'w-16' : 'w-60')}>
        <div className="sticky top-0 h-screen">
          <AdminSidebar navItems={navItems} compact={compact} />
        </div>
      </aside>

      {/* Sidebar: drawer on small screens */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/50" onClick={() => setMenuOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 border-r bg-background">
            <button
              type="button"
              aria-label="Close menu"
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
        <header className="flex h-[61px] shrink-0 items-center gap-2 border-b px-4">
          <Button variant="ghost" size="sm" className="lg:hidden" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
            <Menu className="size-5" />
          </Button>
          <h1 className="truncate text-xl font-bold text-muted-foreground">{title}</h1>
        </header>
        <main className="w-full min-w-0 flex-1 p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
