import { ArrowLeft, Keyboard, LogOut } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import type { NavItem } from '@/app/module.types';
import { useCurrentUser, useLogout } from '@/modules/auth/hooks/use-current-user';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Button } from '@/shared/components/ui/button';
import { ThemeToggle } from '@/shared/components/ui/theme-toggle';
import { cn } from '@/shared/lib/utils';

export const ADMIN_HOME = '/admin';

interface AdminSidebarProps {
  navItems: NavItem[];
  /** Called after a link is clicked (the drawer on small screens closes itself). */
  onNavigate?: () => void;
}

/**
 * The admin area's navigation. Header: the TypeTrace logo (same size as BrandHeader).
 * Footer: the signed-in admin, theme toggle and Logout.
 */
export const AdminSidebar = ({ navItems, onNavigate }: AdminSidebarProps) => {
  const { data: user } = useCurrentUser();
  const handleLogout = useLogout();
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? '??';

  return (
    <nav aria-label="Admin" className="flex h-full flex-col">
      {/* Same height as BrandHeader (py-3 + 36px logo + 1px border = 61px). */}
      <div className="flex h-[61px] shrink-0 items-center border-b px-4">
        <Link to={ADMIN_HOME} onClick={onNavigate} className="flex items-center gap-2 text-lg font-bold">
          <span className="inline-flex size-9 items-center justify-center bg-destructive text-destructive-foreground">
            <Keyboard className="size-5" />
          </span>
          TypeTrace
        </Link>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            // The admin home would otherwise stay highlighted on every admin page.
            end={item.to === ADMIN_HOME}
            onClick={onNavigate}
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
          onClick={onNavigate}
          className="mt-auto flex items-center gap-2 px-3 py-2 text-base text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to app
        </Link>
      </div>

      <div className="flex shrink-0 flex-col gap-2 border-t p-3">
        <div className="flex items-center gap-2 px-1">
          <Avatar className="size-8">
            <AvatarImage src={user?.avatarUrl} alt={user?.email} />
            <AvatarFallback className="bg-primary/15 text-sm text-primary">{initials}</AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{user?.email}</span>
          <ThemeToggle />
        </div>
        <Button variant="ghost" onClick={handleLogout} className="justify-start gap-2 text-muted-foreground hover:text-foreground">
          <LogOut className="size-4" />
          Logout
        </Button>
      </div>
    </nav>
  );
};
