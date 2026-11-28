import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import type { NavItem, NavWidget } from '@/app/module.types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';

const linkClass = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-base transition-colors';
// The phone's bottom tab bar: icon over a small label (cut with … when too long), a tap target at least 44px tall, the bar's width shared in equal columns.
const tabClass = 'flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 px-1 text-[11px] leading-tight transition-colors';

/**
 * The navigation in the center of the header: a link per item (a `{ Component }` item is drawn as it is), the current page marked.
 * For a guest (`guest`, SCRUM-251) the items that are not open to guests are shown locked: dimmed, and "Create an
 * account" in a tooltip on hover or focus; they lead to the Register page.
 * `variant="tabs"` is the phone's bottom tab bar: icon over label, every link the same width.
 */
export const NavLinks = ({ items, guest = false, variant = 'top' }: { items: (NavItem | NavWidget)[]; guest?: boolean; variant?: 'top' | 'tabs' }) => {
  const tabs = variant === 'tabs';
  const base = tabs ? tabClass : linkClass;
  const location = useLocation();
  const { t } = useTranslation();
  const nameOf = (item: NavItem) => (item.labelKey ? t(item.labelKey) : item.label);

  return (
    <nav className={cn(tabs ? 'grid w-full auto-cols-fr grid-flow-col' : 'flex items-center gap-1')}>
      {items.map((item, index) => {
        if ('Component' in item) return guest ? null : <item.Component key={index} />;
        if (guest && !item.guest) {
          return (
            <TooltipProvider key={item.to} delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link to="/register" className={cn(base, 'text-muted-foreground/60 hover:text-foreground')}>
                    <item.icon className={tabs ? 'size-5' : 'size-4'} />
                    <span className={tabs ? 'max-w-full truncate' : 'sr-only lg:not-sr-only'}>{nameOf(item)}</span>
                    <span className="sr-only">{t('nav.locked')}</span>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>{t('nav.createAccount')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        }
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(base, location.pathname === item.to ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}
          >
            <item.icon className={tabs ? 'size-5' : 'size-4'} />
            <span className={tabs ? 'max-w-full truncate' : 'sr-only lg:not-sr-only'}>{nameOf(item)}</span>
          </Link>
        );
      })}
    </nav>
  );
};
