import { Crown } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

/** The mark of a learner on Premium (US11.1): only a crown, no background, next to their name in the account menu and on the Store page. */
export const PremiumBadge = ({ className }: { className?: string }) => (
  <span className={cn('inline-flex items-center text-primary', className)}>
    <Crown className="size-4 fill-current" strokeWidth={1.75} aria-hidden="true" />
    <span className="sr-only">Premium</span>
  </span>
);
