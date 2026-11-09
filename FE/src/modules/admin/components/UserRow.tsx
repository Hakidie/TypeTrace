import { Ban, CircleCheck, Crown, Gem, MailCheck, MailQuestion, Pencil, Shield, Trash2, User } from 'lucide-react';
import type { CurrentUser } from '@/modules/auth/types/auth.types';
import { AvatarSprite } from '@/modules/avatar/components/AvatarSprite';
import { DEFAULT_AVATAR } from '@/modules/avatar/types/avatar.types';
import { ActivityHeatmap, HEATMAP_DAYS } from '@/shared/components/activity-heatmap';
import { LabeledTag } from '@/shared/components/labeled-tag';
import { ListRow, ListRowMenu, ListRowStat } from '@/shared/components/list-row';
import { RowContextMenu } from '@/shared/components/row-context-menu';
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
  /** The plan now (US11.1), shown as a tag; Premium also shows the day it ends. */
  plan?: 'free' | 'premium';
  planExpiresAt?: string | null;
  /** Premium is cancelled: it runs to its end. */
  planCancelled?: boolean;
  /** Adds a "Grant Premium" entry. */
  onGrantPremium?: (user: CurrentUser) => void;
  /** Adds a "Cancel Premium" entry (only for a user on Premium that is not cancelled yet): it ends with the paid time. */
  onCancelPremium?: (user: CurrentUser) => void;
  /** Adds a "Revoke Premium now" entry (only for a user on Premium): it ends at once. */
  onRevokePremium?: (user: CurrentUser) => void;
}

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' });

export const UserRow = ({ user, stats, sessions, status = 'active', onEdit, onToggleStatus, onDelete, plan, planExpiresAt, planCancelled, onGrantPremium, onCancelPremium, onRevokePremium }: UserRowProps) => {
  // Without a display name: the part of the email before the @.
  const name = user.displayName || user.email.split('@')[0];
  const showPicture = Boolean(user.avatarUrl) && user.avatarSource !== 'pixel';

  // The entries of the menu: the one a right click opens and the one of the kebab button that shows while the row is hovered.
  const actions = (
    <>
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
      {onGrantPremium && (
        <DropdownMenuItem className="gap-2" onClick={() => onGrantPremium(user)}>
          <Gem className="size-4" />
          Grant Premium
        </DropdownMenuItem>
      )}
      {onCancelPremium && plan === 'premium' && !planCancelled && (
        <DropdownMenuItem className="gap-2" onClick={() => onCancelPremium(user)}>
          <Crown className="size-4" />
          Cancel Premium
        </DropdownMenuItem>
      )}
      {onRevokePremium && plan === 'premium' && (
        <DropdownMenuItem className="gap-2" onClick={() => onRevokePremium(user)}>
          <Crown className="size-4" />
          Revoke Premium now
        </DropdownMenuItem>
      )}
      {onDelete && (
        <DropdownMenuItem className="gap-2 text-destructive" onClick={() => onDelete(user)}>
          <Trash2 className="size-4" />
          Delete
        </DropdownMenuItem>
      )}

    </>
  );

  return (
    // No background, like a session of the profile: the card's padding goes outside, so its text lines up with the title above.
    <RowContextMenu
      className="-mr-3 -ml-4"
      label={`Actions for ${user.email}`}
      menu={actions}
    >
      <ListRow
        plain
        flat
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
        action={<ListRowMenu label={`Actions for ${user.email}`}>{actions}</ListRowMenu>}
        tags={
          <>
            <LabeledTag icon={user.role === 'admin' ? Shield : User} text={user.role === 'admin' ? 'Admin' : 'User'} hint={user.role === 'admin' ? 'Can open the admin area' : 'A learner'} />
            <LabeledTag
              icon={user.isEmailVerified ? MailCheck : MailQuestion}
              text={user.isEmailVerified ? 'Verified' : 'Unverified'}
              hint={user.isEmailVerified ? 'The email address is confirmed' : 'The email address is not confirmed yet'}
            />
            {plan && (
              <LabeledTag
                icon={plan === 'premium' ? Crown : User}
                text={plan === 'premium' && planExpiresAt ? `${planCancelled ? 'Cancelled' : 'Premium'} · ${formatDay(planExpiresAt)}` : plan === 'premium' ? 'Premium' : 'Free'}
                hint={plan === 'premium' ? (planCancelled ? 'Premium was cancelled: it ends this day' : 'On Premium until this day') : 'On the Free plan'}
              />
            )}
            <Badge variant={status === 'locked' ? 'outline' : 'default'} className={status === 'locked' ? 'border-primary text-primary' : undefined}>
              {status === 'locked' ? <Ban className="mr-1.5 size-4" aria-hidden /> : <CircleCheck className="mr-1.5 size-4" aria-hidden />}
              {status === 'locked' ? 'Locked' : 'Active'}
            </Badge>
          </>
        }
      />
    </RowContextMenu>
  );
};
