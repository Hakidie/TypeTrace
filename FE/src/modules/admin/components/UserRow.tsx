import type { CurrentUser } from '@/modules/auth/types/auth.types';
import { ActivityHeatmap, HEATMAP_DAYS } from '@/shared/components/activity-heatmap';
import { ListRow, ListRowMenu } from '@/shared/components/list-row';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Badge } from '@/shared/components/ui/badge';
import { DropdownMenuItem } from '@/shared/components/ui/dropdown-menu';
import type { UserLoginDay, UserTypingStats } from '../types/admin.types';

interface UserRowProps {
  user: CurrentUser;
  /** Average speed and accuracy. Shown as "—" until the backend sends them. */
  stats?: UserTypingStats;
  /** Sessions per day. Without it the heatmap stays empty. */
  logins?: UserLoginDay[];
  /** Adds an "Edit" entry to the kebab menu. */
  onEdit?: (user: CurrentUser) => void;
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between gap-3">
    <span className="text-sm font-semibold tracking-widest text-primary/70">{label}</span>
    <span className="text-lg font-black leading-none text-primary">{value}</span>
  </div>
);

export const UserRow = ({ user, stats, logins, onEdit }: UserRowProps) => {
  const name = user.displayName || user.email;

  return (
    <ListRow
      identity={
        <div className="flex min-w-0 items-center gap-3">
          {/* 61px = the height of the heatmap. */}
          <Avatar className="size-[61px] shrink-0">
            <AvatarImage src={user.avatarUrl} alt="" />
            <AvatarFallback className="bg-primary/25 text-xl font-black text-primary">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-xl font-extrabold text-primary/80">{name}</p>
            <p className="truncate text-base text-muted-foreground">{user.email}</p>
          </div>
        </div>
      }
      center={
        <div className="space-y-1">
          <Stat label="WPM" value={stats ? String(Math.round(stats.wpm)) : '—'} />
          <Stat label="ACC" value={stats ? `${stats.accuracy.toFixed(1)}%` : '—'} />
        </div>
      }
      extra={<ActivityHeatmap days={logins} since={user.createdAt} label={`Logins in the last ${HEATMAP_DAYS} days`} />}
      action={
        <ListRowMenu label={`Actions for ${user.email}`}>
          {onEdit && <DropdownMenuItem onClick={() => onEdit(user)}>Edit</DropdownMenuItem>}
        </ListRowMenu>
      }
      tags={
        <>
          <Badge>{user.isEmailVerified ? 'Verified' : 'Unverified'}</Badge>
          <Badge className="capitalize">{user.role}</Badge>
        </>
      }
      meta={new Date(user.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
    />
  );
};
