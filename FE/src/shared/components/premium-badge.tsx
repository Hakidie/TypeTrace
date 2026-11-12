import { Crown } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

/** The mark of a learner on Premium (US11.1): next to their name in the account menu and on the Store page. */
export const PremiumBadge = ({ className }: { className?: string }) => (
  <span className={cn('inline-flex items-center gap-1 bg-primary px-1.5 py-0.5 text-xs font-semibold leading-none text-primary-foreground', className)}>
    <Crown className="size-3" aria-hidden="true" />
    Premium
  </span>
);
