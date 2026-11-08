import { Link, useLocation } from 'react-router-dom';
import type { NavItem, NavWidget } from '@/app/module.types';
import { cn } from '@/shared/lib/utils';

/** The navigation in the center of the header: a link per item (a `{ Component }` item is drawn as it is), the current page marked. */
export const NavLinks = ({ items }: { items: (NavItem | NavWidget)[] }) => {
  const location = useLocation();

  return (
    <nav className="flex items-center gap-1">
      {items.map((item, index) =>
        'Component' in item ? (
          <item.Component key={index} />
        ) : (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 text-base transition-colors',
              location.pathname === item.to ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <item.icon className="size-4" />
            <span className="hidden sm:inline">{item.label}</span>
          </Link>
        ),
      )}
    </nav>
  );
};
