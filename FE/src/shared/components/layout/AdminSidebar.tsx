import { ArrowLeft, Keyboard, LogOut, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import type { NavItem } from '@/app/module.types';
import { useCurrentUser, useLogout } from '@/modules/auth/hooks/use-current-user';
import { shownPictureUrl } from '@/modules/auth/utils/avatar-picture';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Button } from '@/shared/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
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
 * Compact sidebar: the text is gone, so a tooltip (to the right of the icon) says what it is. Otherwise the child as it is.
 * The trigger is a wrapper of its own, not the child: a `NavLink` has a `className` function (its active state), which a
 * trigger that merges its props into the child would turn into text.
 */
const CompactTip = ({ compact, label, className, children }: { compact: boolean; label?: string; className?: string; children: ReactNode }) =>
  compact && label ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn('flex flex-col', className)}>{children}</div>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  ) : (
    <>{children}</>
  );

/**
 * Compact sidebar, for a tab: while it is hovered a flyout opens over the page from the icon,
 * with the same icon in the same place and the name of the tab beside it, so the icon does not move and the sidebar keeps
 * its width. Otherwise the child as it is. The flyout is only for the eye (`aria-hidden`): the link keeps its name.
 */
const CompactFlyout = ({
  compact,
  label,
  icon: Icon,
  active,
  className,
  children,
}: {
  compact: boolean;
  label: string;
  icon: LucideIcon;
  /** The tab of the page being shown keeps its tint in the flyout. */
  active?: boolean;
  className?: string;
  children: ReactNode;
}) =>
  compact ? (
    <div className={cn('group/tab relative flex flex-col', className)}>
      {children}
      {/* 9px + the 1px border = the 10px that centers the icon in the 40px wide tab, so it stays where it was. */}
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute left-0 top-0 z-50 hidden h-full items-center gap-2 whitespace-nowrap border bg-background px-[9px] pr-4 text-base shadow-md group-hover/tab:flex',
          active ? 'text-primary' : 'text-foreground',
        )}
      >
        <Icon className="size-5 shrink-0" />
        {label}
      </span>
    </div>
  ) : (
    <>{children}</>
  );

/**
 * The admin area's navigation. Header: the TypeTrace logo (same size as BrandHeader).
 * Footer: the signed-in admin and Logout.
 */
export const AdminSidebar = ({ navItems, onNavigate, compact = false }: AdminSidebarProps) => {
  const { data: user } = useCurrentUser();
  const handleLogout = useLogout();
  const { pathname } = useLocation();
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? '??';
  // Compact: the icon is centered and the text only stays for screen readers.
  const itemClass = cn('flex items-center gap-2 px-3 py-2 text-base', compact && 'justify-center');
  const labelClass = compact ? 'sr-only' : undefined;
  const iconClass = cn('shrink-0', compact ? 'size-5' : 'size-4');

  return (
    <TooltipProvider delayDuration={200}>
    <nav aria-label="Admin" className="flex h-full flex-col">
      {/* Same height as BrandHeader (py-3 + 36px logo + 1px border = 61px). */}
      <div className={cn('flex h-[61px] shrink-0 items-center border-b px-4', compact && 'justify-center px-0')}>
        <CompactTip compact={compact} label="TypeTrace">
          <Link to={ADMIN_HOME} onClick={onNavigate} className="flex items-center gap-2 text-lg font-bold text-primary">
            {/* No background: the icon is as high as the name (its line, 28px), in the theme red like the name. */}
            <Keyboard className="size-7" aria-hidden />
            <span className={labelClass}>TypeTrace</span>
          </Link>
        </CompactTip>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map((item) => (
          <CompactFlyout key={item.to} compact={compact} label={item.label} icon={item.icon} active={pathname === item.to || (item.to !== ADMIN_HOME && pathname.startsWith(`${item.to}/`))}>
            <NavLink
              to={item.to}
              // The admin home would otherwise stay highlighted on every admin page.
              end={item.to === ADMIN_HOME}
              onClick={onNavigate}
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
          </CompactFlyout>
        ))}
        <CompactFlyout compact={compact} label="Back to app" icon={ArrowLeft} className="mt-auto">
          <Link to="/" onClick={onNavigate} className={cn(itemClass, 'mt-auto text-muted-foreground hover:bg-muted hover:text-foreground')}>
            <ArrowLeft className={iconClass} />
            <span className={labelClass}>Back to app</span>
          </Link>
        </CompactFlyout>
      </div>

      <div className="flex shrink-0 flex-col gap-2 border-t p-3">
        <CompactTip compact={compact} label={user?.email}>
          <div className={cn('flex items-center gap-2 px-1', compact && 'justify-center px-0')}>
            <Avatar className="size-8">
              <AvatarImage src={shownPictureUrl(user)} alt={user?.email} />
              <AvatarFallback className="bg-primary/15 text-sm text-primary">{initials}</AvatarFallback>
            </Avatar>
            <span className={cn('min-w-0 flex-1 truncate text-sm text-muted-foreground', compact && 'sr-only')}>{user?.email}</span>
          </div>
        </CompactTip>
        <CompactTip compact={compact} label="Logout">
          <Button variant="ghost" onClick={handleLogout} className={cn('justify-start gap-2 text-muted-foreground hover:text-foreground', compact && 'justify-center px-0')}>
            <LogOut className={iconClass} />
            <span className={labelClass}>Logout</span>
          </Button>
        </CompactTip>
      </div>
    </nav>
    </TooltipProvider>
  );
};
