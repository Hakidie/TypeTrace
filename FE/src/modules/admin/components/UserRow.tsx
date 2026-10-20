import { Ban, CircleCheck, Pencil, Trash2 } from 'lucide-react';
import type { CurrentUser } from '@/modules/auth/types/auth.types';
import { ActivityHeatmap, HEATMAP_DAYS } from '@/shared/components/activity-heatmap';
import { ListRow, ListRowMenu } from '@/shared/components/list-row';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Badge } from '@/shared/components/ui/badge';
import { DropdownMenuItem } from '@/shared/components/ui/dropdown-menu';
import { currentStreak } from '@/shared/lib/streak';
import type { UserSessionDay, UserStatus, UserTypingStats } from '../types/admin.types';

interface UserRowProps {
  user: CurrentUser;
  /** Average speed and accuracy. Shown as "0000" and "000%" until the backend sends them. */
  stats?: UserTypingStats;
  /** Sessions per day. Without it the heatmap stays empty. */
  sessions?: UserSessionDay[];
  /** Adds an "Edit" entry to the kebab menu. */
  onEdit?: (user: CurrentUser) => void;
  /** Locked or active; missing counts as active. Shown as a tag. */
  status?: UserStatus;
  /** Adds a "Disable" entry (or "Enable" when the user is locked) to the kebab menu. */
  onToggleStatus?: (user: CurrentUser) => void;
  /** Adds a "Delete" entry to the kebab menu. The caller asks for confirmation. */
  onDelete?: (user: CurrentUser) => void;
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="flex h-[61px] flex-col text-right">
    <span className="text-base font-semibold leading-none tracking-widest text-primary/70">{label}</span>
    <span className="flex flex-1 items-end justify-end text-3xl font-black leading-none text-primary">{value}</span>
  </div>
);

export const UserRow = ({ user, stats, sessions, status = 'active', onEdit, onToggleStatus, onDelete }: UserRowProps) => {
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
            <p className="truncate text-2xl font-extrabold text-primary/80">{name}</p>
            <p className="truncate text-lg text-muted-foreground">{user.email}</p>
          </div>
        </div>
      }
      center={<ActivityHeatmap days={sessions} since={user.createdAt} label={`Completed sessions in the last ${HEATMAP_DAYS} days`} />}
      extra={
        <div className="flex w-full justify-between gap-4 xl:w-72">
          <Stat label="STREAK" value={sessions ? `${String(currentStreak(sessions)).padStart(3, '0')}D` : '—'} />
          <Stat label="ACC" value={stats ? `${stats.accuracy.toFixed(1)}%` : '000%'} />
          <Stat label="WPM" value={stats ? String(Math.round(stats.wpm)) : '0000'} />
        </div>
      }
      action={
        <ListRowMenu label={`Actions for ${user.email}`}>
          {onEdit && (
            <DropdownMenuItem className="gap-2" onClick={() => onEdit(user)}>
              <Pencil className="size-4" />
              Edit
            </DropdownMenuItem>
          )}
          {onToggleStatus && (
            <DropdownMenuItem className="gap-2" onClick={() => onToggleStatus(user)}>
              {status === 'locked' ? <CircleCheck className="size-4" /> : <Ban className="size-4" />}
              {status === 'locked' ? 'Enable' : 'Disable'}
            </DropdownMenuItem>
          )}
          {onDelete && (
            <DropdownMenuItem className="gap-2 text-destructive" onClick={() => onDelete(user)}>
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          )}
        </ListRowMenu>
      }
      tags={
        <>
          <Badge variant={status === 'locked' ? 'outline' : 'default'} className={status === 'locked' ? 'border-primary text-primary' : undefined}>
            {status === 'locked' ? 'Locked' : 'Active'}
          </Badge>
          <Badge>{user.isEmailVerified ? 'Verified' : 'Unverified'}</Badge>
          <Badge className="capitalize">{user.role}</Badge>
        </>
      }
      meta={new Date(user.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
    />
  );
};
