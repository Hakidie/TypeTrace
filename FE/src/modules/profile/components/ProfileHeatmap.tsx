import type { UseQueryResult } from '@tanstack/react-query';
import { ActivityHeatmap, type ActivityDay } from '@/shared/components/activity-heatmap';
import { ErrorState } from '@/shared/components/error-state';
import { dateKeyIn } from '@/shared/lib/local-date';
import type { TypingActivity } from '../types/profile.types';

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** The heatmap in words, for screen readers (the cells are a picture), e.g. "Counted sessions in 2026: 42 on 18 days, ...". */
const summaryOf = (year: string, days: ActivityDay[]) => {
  const sessions = days.reduce((total, day) => total + day.sessions, 0);
  const missionDays = days.filter((day) => day.missionCompleted).length;
  return `Counted sessions in ${year}: ${sessions} on ${plural(days.length, 'day')}, daily mission done on ${plural(missionDays, 'day')}`;
};

interface ProfileHeatmapProps {
  /** The learner's typing activity (`useTypingActivity`): the days, their time zone, and the error with its retry. */
  activity: UseQueryResult<TypingActivity>;
  /** The day the account was made: earlier days count as no activity. */
  since: string;
}

/**
 * The heatmap of this calendar year (four quarters, 128px of cells and month names: two thirds of the header panel above
 * it, which keeps the cells nearly square) on its own and without a frame (sits under `ProfileHeader`): the counted
 * sessions of each day, in the learner's time zone, a mark on the days the daily mission was done, the tooltip of the
 * hovered day and the legend under it; screen readers get the year in words. The cells are empty while the activity
 * loads; when it fails the error is shown with a retry, and a year without any counted session says so in one muted line
 * (the link to practice is the one of `TodayProgress`, above).
 */
export const ProfileHeatmap = ({ activity, since }: ProfileHeatmapProps) => {
  if (activity.isError) return <ErrorState error={activity.error} onRetry={() => void activity.refetch()} />;

  const timeZone = activity.data?.timezone;
  const year = dateKeyIn(new Date(), timeZone).slice(0, 4);
  // The days drawn: `sessions` goes back 371 days, so it can hold some of last year.
  const daysOfYear = activity.data?.sessions.filter((day) => day.date.startsWith(year));
  return (
    <>
      {/* 150px: the 128px of cells and month names, then the legend and the gap over it (22px). */}
      <div className="h-[150px]">
        <ActivityHeatmap
          days={activity.data?.sessions}
          since={since}
          timeZone={timeZone}
          label={daysOfYear ? summaryOf(year, daysOfYear) : `Counted sessions in ${year}`}
          unit="counted session"
          fill
          labels
          calendarYear
          legend
        />
      </div>
      {daysOfYear?.length === 0 && (
        <p className="mt-2 text-base text-muted-foreground">No counted sessions this year: your practice days show here.</p>
      )}
    </>
  );
};
