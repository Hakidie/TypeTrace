import type { UseQueryResult } from '@tanstack/react-query';
import { ActivityHeatmap, type ActivityDay } from '@/shared/components/activity-heatmap';
import { ErrorState } from '@/shared/components/error-state';
import { dateKeyIn } from '@/shared/lib/local-date';
import type { TypingActivity } from '../types/profile.types';

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** The heatmap in words, for screen readers (the cells are a picture), e.g. "Counted sessions in 2026: 42 on 18 days, ...". */
const summaryOf = (year: string, days: ActivityDay[]) => {
  const sessions = days.reduce((total, day) => total + day.sessions, 0);
  const tasks = days.reduce((total, day) => total + (day.tasksDone ?? 0), 0);
  return `Counted sessions in ${year}: ${sessions} on ${plural(days.length, 'day')}, ${plural(tasks, 'daily task')} done`;
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
 * sessions of each day, in the learner's time zone, the daily tasks done on each day in the tooltip of the
 * hovered day (the legend is in the title row of the page); screen readers get the year in words. The cells are empty while the activity
 * loads; when it fails the error is shown with a retry; a year without any counted session just shows empty cells.
 */
export const ProfileHeatmap = ({ activity, since }: ProfileHeatmapProps) => {
  if (activity.isError) return <ErrorState error={activity.error} onRetry={() => void activity.refetch()} />;

  const timeZone = activity.data?.timezone;
  const year = dateKeyIn(new Date(), timeZone).slice(0, 4);
  // The days drawn: `sessions` goes back 371 days, so it can hold some of last year.
  const daysOfYear = activity.data?.sessions.filter((day) => day.date.startsWith(year));
  // 128px: the cells and the month names. The legend is in the title row of the panel (`ActivityHeatmapLegend`).
  return (
    <div className="h-[128px]">
      <ActivityHeatmap
        days={activity.data?.sessions}
        since={since}
        timeZone={timeZone}
        label={daysOfYear ? summaryOf(year, daysOfYear) : `Counted sessions in ${year}`}
        unit="counted session"
        fill
        labels
        calendarYear
      />
    </div>
  );
};
