import { Crown, UserRound } from 'lucide-react';
import { ListRow, ListRowStat } from '@/shared/components/list-row';
import { SOURCE_LABELS } from '../plan.config';
import { SubscriptionTerm } from './SubscriptionTerm';
import type { SubscriptionRow } from '../types/plan.types';

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' });

/**
 * One plan change of a user, built like the session card of the profile (`ListRow`, `plain`): the icon of the plan, the user's name and the day it started on the left;
 * the term in the middle (`SubscriptionTerm`), and the plan, the payment method and the day Premium ends on the right. The admin who made the change is named after the date.
 */
export const SubscriptionCard = ({ row }: { row: SubscriptionRow }) => {
  const PlanIcon = row.plan === 'premium' ? Crown : UserRound;
  return (
    <ListRow
      plain
      identity={
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-[61px] w-9 shrink-0 items-center justify-center text-primary" aria-hidden>
            <PlanIcon className="size-9" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-2xl font-extrabold text-primary/80">{row.userName}</p>
            <p className="truncate text-lg text-muted-foreground">{row.changedByName ? `${formatDate(row.startsAt)} · by ${row.changedByName}` : formatDate(row.startsAt)}</p>
          </div>
        </div>
      }
      center={<SubscriptionTerm row={row} />}
      extra={
        <div className="flex w-full justify-between gap-4 xl:w-auto xl:justify-end xl:gap-8">
          <ListRowStat className="w-24" label="PLAN" value={row.plan === 'premium' ? 'Premium' : 'Free'} />
          <ListRowStat className="w-28" label="SOURCE" value={SOURCE_LABELS[row.source] ?? 'None'} />
          <ListRowStat className="w-28" label="EXPIRES" value={row.expiresAt ? formatDate(row.expiresAt) : 'None'} />
        </div>
      }
    />
  );
};
