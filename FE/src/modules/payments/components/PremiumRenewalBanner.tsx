import { Crown, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { Button } from '@/shared/components/ui/button';
import { daysLeftText, shouldAskToRenew } from '../lib/store';

const KEY_PREFIX = 'typetrace:renewal-banner-closed:';

/** "Not now" is remembered for this end date only: once Premium is extended its date changes and the banner has nothing to say. */
const wasClosed = (until: string) => {
  try {
    return localStorage.getItem(KEY_PREFIX + until) === '1';
  } catch {
    return false;
  }
};

/**
 * A bar at the bottom of every page of the app when Premium ends within `RENEWAL_BANNER_DAYS`: it asks whether to extend and
 * opens the Store, where a paid month is added after the days left. Worked out from the account when the app opens (no job).
 */
export const PremiumRenewalBanner = () => {
  const { data: user } = useCurrentUser();
  const { pathname } = useLocation();
  const [closed, setClosed] = useState<string | null>(null);
  const until = user?.premium?.until;

  if (!until || !shouldAskToRenew(user?.premium) || closed === until || wasClosed(until) || pathname.startsWith('/store')) return null;

  const close = () => {
    setClosed(until);
    try {
      localStorage.setItem(KEY_PREFIX + until, '1');
    } catch {
      /* the banner only stays closed until the page is reloaded */
    }
  };

  return (
    <aside
      role="region"
      aria-label="Premium ends soon"
      className="fixed inset-x-0 bottom-0 z-40 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t bg-background/90 px-4 py-3 backdrop-blur-xs"
    >
      <p className="flex items-center gap-2 text-sm">
        <Crown className="size-4 text-primary" aria-hidden="true" />
        Your Premium ends in {daysLeftText(until)}. Do you want to extend it?
      </p>
      <div className="flex items-center gap-2">
        <Button asChild size="sm">
          <Link to="/store">Extend Premium</Link>
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={close}>
          <X className="size-4" aria-hidden="true" />
          Not now
        </Button>
      </div>
    </aside>
  );
};
