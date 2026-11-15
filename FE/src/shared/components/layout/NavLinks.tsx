import { Link, useLocation } from 'react-router-dom';
import type { NavItem, NavWidget } from '@/app/module.types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';

const linkClass = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-base transition-colors';

/**
 * The navigation in the center of the header: a link per item (a `{ Component }` item is drawn as it is), the current page marked.
 * For a guest (`guest`, SCRUM-251) the items that are not open to guests are shown locked: dimmed, and "Create an
 * account" in a tooltip on hover or focus; they lead to the Register page.
 */
export const NavLinks = ({ items, guest = false }: { items: (NavItem | NavWidget)[]; guest?: boolean }) => {
  const location = useLocation();

  return (
    <nav className="flex items-center gap-1">
      {items.map((item, index) => {
        if ('Component' in item) return guest ? null : <item.Component key={index} />;
        if (guest && !item.guest) {
          return (
            <TooltipProvider key={item.to} delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link to="/register" className={cn(linkClass, 'text-muted-foreground/60 hover:text-foreground')}>
                    <item.icon className="size-4" />
                    <span className="hidden sm:inline">{item.label}</span>
                    <span className="sr-only">(locked)</span>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>Create an account</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        }
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(linkClass, location.pathname === item.to ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}
          >
            <item.icon className="size-4" />
            <span className="hidden sm:inline">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};
