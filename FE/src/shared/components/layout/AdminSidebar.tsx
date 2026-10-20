import { ArrowLeft, Keyboard, LogOut } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import type { NavItem } from '@/app/module.types';
import { useCurrentUser, useLogout } from '@/modules/auth/hooks/use-current-user';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';

export const ADMIN_HOME = '/admin';

interface AdminSidebarProps {
  navItems: NavItem[];
  /** Called after a link is clicked (the drawer on small screens closes itself). */
  onNavigate?: () => void;
  /** Icons only, no text (the Compact sidebar setting). Text stays as the tooltip and the accessible name. */
  compact?: boolean;
}

/**
 * The admin area's navigation. Header: the TypeTrace logo (same size as BrandHeader).
 * Footer: the signed-in admin and Logout.
 */
export const AdminSidebar = ({ navItems, onNavigate, compact = false }: AdminSidebarProps) => {
  const { data: user } = useCurrentUser();
  const handleLogout = useLogout();
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? '??';
  // Compact: the icon is centered and the text only stays for screen readers.
  const itemClass = cn('flex items-center gap-2 px-3 py-2 text-base', compact && 'justify-center');
  const labelClass = compact ? 'sr-only' : undefined;
  const iconClass = cn('shrink-0', compact ? 'size-5' : 'size-4');

  return (
    <nav aria-label="Admin" className="flex h-full flex-col">
      {/* Same height as BrandHeader (py-3 + 36px logo + 1px border = 61px). */}
      <div className={cn('flex h-[61px] shrink-0 items-center border-b px-4', compact && 'justify-center px-0')}>
        <Link to={ADMIN_HOME} onClick={onNavigate} className="flex items-center gap-2 text-lg font-bold">
          <span className="inline-flex size-9 items-center justify-center bg-destructive text-destructive-foreground">
            <Keyboard className="size-5" />
          </span>
          <span className={labelClass}>TypeTrace</span>
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
            title={compact ? item.label : undefined}
            className={({ isActive }) =>
              cn(
                itemClass,
                'transition-colors',
                isActive ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )
            }
          >
            <item.icon className={iconClass} />
            <span className={labelClass}>{item.label}</span>
          </NavLink>
        ))}
        <Link
          to="/"
          onClick={onNavigate}
          title={compact ? 'Back to app' : undefined}
          className={cn(itemClass, 'mt-auto text-muted-foreground hover:bg-muted hover:text-foreground')}
        >
          <ArrowLeft className={iconClass} />
          <span className={labelClass}>Back to app</span>
        </Link>
      </div>

      <div className="flex shrink-0 flex-col gap-2 border-t p-3">
        <div className={cn('flex items-center gap-2 px-1', compact && 'justify-center px-0')} title={compact ? user?.email : undefined}>
          <Avatar className="size-8">
            <AvatarImage src={user?.avatarUrl} alt={user?.email} />
            <AvatarFallback className="bg-primary/15 text-sm text-primary">{initials}</AvatarFallback>
          </Avatar>
          <span className={cn('min-w-0 flex-1 truncate text-sm text-muted-foreground', compact && 'sr-only')}>{user?.email}</span>
        </div>
        <Button variant="ghost" onClick={handleLogout}
          title={compact ? 'Logout' : undefined}
          className={cn('justify-start gap-2 text-muted-foreground hover:text-foreground', compact && 'justify-center px-0')}
        >
          <LogOut className={iconClass} />
          <span className={labelClass}>Logout</span>
        </Button>
      </div>
    </nav>
  );
};
