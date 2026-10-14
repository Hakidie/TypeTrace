import { ArrowLeft, Keyboard, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import type { NavItem } from '@/app/module.types';
import { useCurrentUser, useLogout } from '@/modules/auth/hooks/use-current-user';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { BrandFooter } from '@/shared/components/layout/BrandFooter';
import { Button } from '@/shared/components/ui/button';
import { ThemeToggle } from '@/shared/components/ui/theme-toggle';
import { cn } from '@/shared/lib/utils';

const ADMIN_HOME = '/admin';

interface AdminLayoutProps {
  navItems: NavItem[];
}

/**
 * Shell of the admin area: sidebar navigation (a drawer on small screens),
 * top bar with the signed-in admin, and the page in the middle.
 */
export const AdminLayout = ({ navItems }: AdminLayoutProps) => {
  const { data: user } = useCurrentUser();
  const handleLogout = useLogout();
  const [menuOpen, setMenuOpen] = useState(false);
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? '??';

  const sidebar = (
    <nav aria-label="Admin" className="flex h-full flex-col gap-1 p-3">
      <Link to={ADMIN_HOME} className="mb-4 flex items-center gap-2 px-3 py-2 text-base font-semibold">
        <div className="flex size-7 items-center justify-center bg-destructive text-destructive-foreground">
          <Keyboard className="size-4" />
        </div>
        Admin
      </Link>
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          // The admin home would otherwise stay highlighted on every admin page.
          end={item.to === ADMIN_HOME}
          onClick={() => setMenuOpen(false)}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2 px-3 py-2 text-base transition-colors',
              isActive ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )
          }
        >
          <item.icon className="size-4" />
          {item.label}
        </NavLink>
      ))}
      <Link
        to="/"
        className="mt-auto flex items-center gap-2 px-3 py-2 text-base text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to app
      </Link>
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar: fixed column on large screens */}
      <aside className="hidden w-60 shrink-0 border-r bg-card lg:block">
        <div className="sticky top-0 h-screen">{sidebar}</div>
      </aside>

      {/* Sidebar: drawer on small screens */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/50" onClick={() => setMenuOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 border-r bg-card">
            <button
              type="button"
              aria-label="Close menu"
              className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
              onClick={() => setMenuOpen(false)}
            >
              <X className="size-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-card px-4">
          <Button variant="ghost" size="sm" className="lg:hidden" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
            <Menu className="size-5" />
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Avatar className="size-8">
              <AvatarImage src={user?.avatarUrl} alt={user?.email} />
              <AvatarFallback className="text-sm">{initials}</AvatarFallback>
            </Avatar>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1.5 text-muted-foreground hover:text-foreground">
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
          <Outlet />
        </main>

        <BrandFooter />
      </div>
    </div>
  );
};
