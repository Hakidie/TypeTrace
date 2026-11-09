import { AvatarSprite } from '@/modules/avatar/components/AvatarSprite';
import { ListRow, ListRowStat } from '@/shared/components/list-row';
import { SOURCE_LABELS } from '../plan.config';
import { SubscriptionPeriod } from './SubscriptionPeriod';
import type { SubscriptionRow } from '../types/plan.types';


const STATUS_LABELS: Record<SubscriptionRow['status'], string> = { upcoming: 'Upcoming', active: 'Active', cancelled: 'Cancelled', ended: 'Ended' };

/**
 * One plan change of a user, built like the session card of the profile (`ListRow`, `plain`): the avatar of the user, their name and email under it on the left;
 * the period in the middle (`SubscriptionPeriod`: start → end, `Now` while it has no end, and the admin who made the change under them), and the plan, the payment method and the status on the right.
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
        <div className="flex w-full justify-between gap-4 xl:w-auto xl:justify-end xl:gap-0">
          <ListRowStat className="w-40" label="PLAN" value={row.plan === 'premium' ? 'Premium' : 'Free'} />
          <ListRowStat className="w-40" label="SOURCE" value={SOURCE_LABELS[row.source] ?? 'None'} />
          <ListRowStat className="w-40" label="STATUS" value={STATUS_LABELS[row.status]} />
        </div>
      }
    />
  );
};
