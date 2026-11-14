import { AvatarSprite } from '@/modules/avatar/components/AvatarSprite';
import { ListRow, ListRowStat } from '@/shared/components/list-row';
import { SOURCE_LABELS } from '../plan.config';
import { SubscriptionPeriod } from './SubscriptionPeriod';
import type { SubscriptionRow } from '../types/plan.types';


const longest = (labels: string[]) => labels.reduce((a, b) => (b.length > a.length ? b : a));

/**
 * One stat of the right side. Its width is the width of the longest value it can have (an invisible copy of it, drawn by CSS from `data-widest`, shares the cell), so the columns are as wide as their text:
 * the gaps between them are the same in every row and the columns line up from row to row.
 */
const Column = ({ label, value, widest }: { label: string; value: string; widest: string }) => (
  <div
    data-widest={widest}
    className="grid after:invisible after:col-start-1 after:row-start-1 after:h-0 after:overflow-hidden after:text-3xl after:font-black after:whitespace-nowrap after:content-[attr(data-widest)]"
  >
    <ListRowStat className="col-start-1 row-start-1" label={label} value={value} />
  </div>
);

const STATUS_LABELS: Record<SubscriptionRow['status'], string> = { upcoming: 'Upcoming', active: 'Active', cancelled: 'Cancelled', ended: 'Ended' };

/**
 * One plan change of a user, built like the session card of the profile (`ListRow`, `plain`): the avatar of the user, their name and email under it on the left;
 * the period in the middle (`SubscriptionPeriod`: a progress bar of the term with its start day on the left and its end day on the right under it, `Now` while it has no end; the admin who made the change, `by Boss`, sits between the two days), and the plan, the payment method and the status on the right.
 */
export const SubscriptionCard = ({ row }: { row: SubscriptionRow }) => {
  return (
    <ListRow
      plain
      flat
      identity={
        <div className="flex min-w-0 items-center gap-3">
          {/* 61px = the height of the card. The uploaded picture, else the face of the pixel avatar. */}
          <div className="flex size-[61px] shrink-0 items-center justify-center overflow-hidden">
            {row.avatarUrl ? (
              <img src={row.avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              <AvatarSprite look={row.avatar} crop="head" scale={1.5} label={`Avatar of ${row.userName}`} />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-2xl font-extrabold text-primary/80">{row.userName}</p>
            <p className="truncate text-lg text-muted-foreground">{row.email ?? ''}</p>
          </div>
        </div>
      }
      center={<SubscriptionPeriod row={row} />}
      extra={
        <div className="flex w-full justify-between gap-4 xl:w-auto xl:justify-end xl:gap-8">
          <Column label="PLAN" value={row.plan === 'premium' ? 'Premium' : 'Free'} widest="Premium" />
          <Column label="SOURCE" value={SOURCE_LABELS[row.source] ?? 'None'} widest={longest(Object.values(SOURCE_LABELS))} />
          <Column label="STATUS" value={STATUS_LABELS[row.status]} widest={longest(Object.values(STATUS_LABELS))} />
        </div>
      }
    />
  );
};
