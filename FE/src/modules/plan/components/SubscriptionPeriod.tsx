import { ChevronRight } from 'lucide-react';
import type { SubscriptionRow } from '../types/plan.types';

const formatShort = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });

/**
 * The middle of a subscription card, 61px high like the speed line of a session: the day the term starts and the day it ends (`Now` while it has no end)
 * joined by a line with an arrowhead that stretches to fill the space between them, in the style of the user's name; under them, who made the change when an admin did.
 */
export const SubscriptionPeriod = ({ row }: { row: Pick<SubscriptionRow, 'startsAt' | 'endsAt' | 'changedByName'> }) => (
  <div className="flex h-[61px] w-full min-w-0 flex-col items-center justify-center pl-24">
    <div className="flex w-full items-center gap-3 text-2xl font-extrabold text-primary/80">
      <span>{formatShort(row.startsAt)}</span>
      <span className="flex min-w-6 flex-1 items-center text-primary/50" aria-hidden>
        <span className="h-0.5 flex-1 bg-current" />
        <ChevronRight className="-ml-3 size-6 shrink-0" strokeWidth={2.5} />
      </span>
      <span className="sr-only">to</span>
      <span>{row.endsAt ? formatShort(row.endsAt) : 'Now'}</span>
    </div>
    {row.changedByName && <p className="truncate text-lg text-muted-foreground">{`by ${row.changedByName}`}</p>}
  </div>
);
