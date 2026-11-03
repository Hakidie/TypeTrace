import { Ban, CircleCheck, MailCheck, MailQuestion, Pencil, Shield, Trash2, User } from 'lucide-react';
import type { CurrentUser } from '@/modules/auth/types/auth.types';
import { AvatarSprite } from '@/modules/avatar/components/AvatarSprite';
import { DEFAULT_AVATAR } from '@/modules/avatar/types/avatar.types';
import { ActivityHeatmap, HEATMAP_DAYS } from '@/shared/components/activity-heatmap';
import { LabeledTag } from '@/shared/components/labeled-tag';
import { ListRow, ListRowMenu, ListRowStat } from '@/shared/components/list-row';
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

export const UserRow = ({ user, stats, sessions, status = 'active', onEdit, onToggleStatus, onDelete }: UserRowProps) => {
  // Without a display name: the part of the email before the @.
  const name = user.displayName || user.email.split('@')[0];
  const showPicture = Boolean(user.avatarUrl) && user.avatarSource !== 'pixel';

  return (
    <ListRow
      identity={
        <div className="flex min-w-0 items-center gap-3">
          {/* 61px = the height of the heatmap. The uploaded picture, unless the account chose its pixel avatar (or never set a picture): then its face, the default avatar while it never changed it. */}
          <div className="flex size-[61px] shrink-0 items-center justify-center overflow-hidden">
            {showPicture ? (
              <img src={user.avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              <AvatarSprite look={user.avatar ?? DEFAULT_AVATAR} crop="head" scale={1.5} label={`Avatar of ${name}`} />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-2xl font-extrabold text-primary/80">{name}</p>
            <p className="truncate text-lg text-muted-foreground">{user.email}</p>
          </div>
        </div>
      }
      center={<ActivityHeatmap days={sessions} since={user.createdAt} label={`Completed sessions in the last ${HEATMAP_DAYS} days`} />}
      extra={
        <div className="flex w-full justify-between gap-4 xl:w-72">
          <ListRowStat label="STREAK" value={sessions ? `${String(currentStreak(sessions)).padStart(3, '0')}D` : '—'} />
          <ListRowStat label="ACC" value={stats ? `${stats.accuracy.toFixed(1)}%` : '000%'} />
          <ListRowStat label="WPM" value={stats ? String(Math.round(stats.wpm)) : '0000'} />
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
          <LabeledTag icon={user.role === 'admin' ? Shield : User} text={user.role === 'admin' ? 'Admin' : 'User'} hint={user.role === 'admin' ? 'Can open the admin area' : 'A learner'} />
          <LabeledTag
            icon={user.isEmailVerified ? MailCheck : MailQuestion}
            text={user.isEmailVerified ? 'Verified' : 'Unverified'}
            hint={user.isEmailVerified ? 'The email address is confirmed' : 'The email address is not confirmed yet'}
          />
          <Badge variant={status === 'locked' ? 'outline' : 'default'} className={status === 'locked' ? 'border-primary text-primary' : undefined}>
            {status === 'locked' ? <Ban className="mr-1.5 size-4" aria-hidden /> : <CircleCheck className="mr-1.5 size-4" aria-hidden />}
            {status === 'locked' ? 'Locked' : 'Active'}
          </Badge>
        </>
      }
      meta={new Date(user.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
    />
  );
};
