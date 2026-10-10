import type { ComponentType } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { LogOut, ShieldCheck } from 'lucide-react';
import type { NavItem } from '@/app/module.types';
import { ThemeToggle } from '@/shared/components/ui/theme-toggle';
import { useCurrentUser, useLogout } from '@/modules/auth/hooks/use-current-user';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Button } from '@/shared/components/ui/button';
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
  const handleLogout = useLogout();

  const navItems = allNavItems.filter((item) => !item.roles || (user && item.roles.includes(user.role)));

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? '??';

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 text-base font-semibold">
            <div className="flex size-7 items-center justify-center bg-primary/20 text-primary">
              <ShieldCheck className="size-4" />
            </div>
            <span className="hidden sm:inline">MERN Auth</span>
          </Link>

          {/* Nav links */}
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

          {/* User + logout */}
          <div className="flex items-center gap-2">
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
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>

      {widgets.map((Widget, index) => (
        <Widget key={index} />
      ))}
    </div>
  );
};
