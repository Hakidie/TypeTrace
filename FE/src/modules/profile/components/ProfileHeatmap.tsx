import type { UseQueryResult } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ActivityHeatmap } from '@/shared/components/activity-heatmap';
import { ErrorState } from '@/shared/components/error-state';
import type { TypingActivity } from '../types/profile.types';

interface ProfileHeatmapProps {
  /** The learner's typing activity (`useTypingActivity`): the days, and the error with its retry. */
  activity: UseQueryResult<TypingActivity>;
  /** The day the account was made: earlier days count as no activity. */
  since: string;
}

/**
 * The heatmap of this calendar year (four quarters, 96px high) on its own and without a frame (sits under
 * `ProfileHeader`). The cells are empty while the activity loads; when it fails the error is shown with a retry, and a
 * learner without a completed session is pointed to the Typing page.
 */
export const ProfileHeatmap = ({ activity, since }: ProfileHeatmapProps) => {
  if (activity.isError) return <ErrorState error={activity.error} onRetry={() => void activity.refetch()} />;

  const nothingYet = activity.isSuccess && !activity.data.stats && activity.data.sessions.length === 0;
  return (
    <>
      <div className="h-24">
        <ActivityHeatmap days={activity.data?.sessions} since={since} label={`Completed sessions in ${new Date().getUTCFullYear()}`} fill labels calendarYear />
      </div>
      {nothingYet && (
        <p className="mt-2 text-base text-muted-foreground">
          No completed sessions yet.{' '}
          <Link to="/typing" className="text-primary underline-offset-4 hover:underline">
            Practice on the Typing page
          </Link>{' '}
          to fill this in.
        </p>
      )}
    </>
  );
};
