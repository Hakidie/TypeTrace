import type { UseQueryResult } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { CurrentUser } from '@/modules/auth/types/auth.types';
import { ActivityHeatmap, HEATMAP_DAYS } from '@/shared/components/activity-heatmap';
import { ErrorState } from '@/shared/components/error-state';
import { ListRowStat } from '@/shared/components/list-row';
import { Badge } from '@/shared/components/ui/badge';
import { currentStreak } from '@/shared/lib/streak';
import type { TypingActivity } from '../types/profile.types';
import { AvatarUpload } from './AvatarUpload';

interface ProfileSummaryProps {
  user: CurrentUser;
  /** The learner's typing activity (`useTypingActivity`): the numbers and the heatmap, while it loads and when it fails. */
  activity: UseQueryResult<TypingActivity>;
  /** Called with the new image once the avatar is uploaded. */
  onAvatarChange: (avatarUrl: string) => void;
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

/**
 * Top of the profile page (SCRUM-157), in the look of the user rows of the admin area (`UserRow`): the avatar (click to
 * change it), the name and email, the streak, accuracy and speed, then the heatmap of the last year across the whole
 * width (on phones too, unlike in the rows), and at the bottom the tags and the day the account was made.
 */
export const ProfileSummary = ({ user, activity, onAvatarChange }: ProfileSummaryProps) => {
  const name = user.displayName || user.email;
  const sessions = activity.data?.sessions;
  const stats = activity.data?.stats;
  const nothingYet = activity.isSuccess && !stats && sessions?.length === 0;

  return (
    <article aria-label="Profile summary" className="bg-primary/15 text-primary">
      <div className="flex flex-col gap-4 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <AvatarUpload currentAvatarUrl={user.avatarUrl} userInitials={name.slice(0, 2).toUpperCase()} onUploadSuccess={onAvatarChange} />
          <div className="min-w-0">
            <p className="truncate text-2xl font-extrabold text-primary/80">{name}</p>
            {/* Without a display name the email is already the name: a hint instead of the same email twice. */}
            <p className="truncate text-lg text-muted-foreground">{user.displayName ? user.email : 'No display name yet: add one in Edit profile.'}</p>
          </div>
        </div>
        {/* Like the user rows: zeros until a session is completed, a dash while the activity loads. */}
        <div className="flex justify-between gap-6 sm:justify-end sm:gap-8">
          <ListRowStat label="STREAK" value={sessions ? `${String(currentStreak(sessions)).padStart(3, '0')}D` : '—'} />
          <ListRowStat label="ACC" value={stats ? `${stats.accuracy.toFixed(1)}%` : '000%'} />
          <ListRowStat label="WPM" value={stats ? String(Math.round(stats.wpm)) : '0000'} />
        </div>
      </div>

      {user.bio && <p className="border-t border-background px-4 py-3 text-base text-muted-foreground">{user.bio}</p>}

      <div className="space-y-2 border-t border-background px-4 py-3">
        {activity.isError ? (
          <ErrorState error={activity.error} onRetry={() => void activity.refetch()} />
        ) : (
          <ActivityHeatmap days={sessions} since={user.createdAt} label={`Completed sessions in the last ${HEATMAP_DAYS} days`} />
        )}
        {nothingYet && (
          <p className="text-base text-muted-foreground">
            No completed sessions yet.{' '}
            <Link to="/typing" className="text-primary underline-offset-4 hover:underline">
              Practice on the Typing page
            </Link>{' '}
            to fill this in.
          </p>
        )}
      </div>

      <div className="flex items-stretch justify-between gap-2 border-t border-background">
        <div className="flex flex-wrap items-center gap-1.5 px-4 py-1.5">
          <Badge>{user.isEmailVerified ? 'Verified' : 'Unverified'}</Badge>
          <Badge>{user.role === 'admin' ? 'Admin' : 'Learner'}</Badge>
        </div>
        <p className="flex items-center border-l border-background px-4 py-1.5 text-sm text-primary/70">Joined {formatDate(user.createdAt)}</p>
      </div>
    </article>
  );
};
