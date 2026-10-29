import type { UseQueryResult } from '@tanstack/react-query';
import { CircleCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '@/shared/api/api-error';
import { cn } from '@/shared/lib/utils';
import type { Streak } from '../types/profile.types';

const plural = (count: number, word: string) => `${word}${count === 1 ? '' : 's'}`;
const linkClass = 'text-primary underline-offset-4 hover:underline';

/**
 * One line above the heatmap (it wraps on phones): today's counted sessions and today's daily mission, done or not (then
 * with a link to the Typing page). The goal comes from the backend (`missionGoal`). While it loads, the same line with
 * dashes, shaped like a mission still to do, so the heatmap under it does not move when the numbers come; when it fails,
 * the reason and a retry on the same line.
 */
export const TodayProgress = ({ streak }: { streak: UseQueryResult<Streak> }) => {
  if (streak.isError) {
    return (
      <p role="alert" className="text-base text-muted-foreground">
        <span className="text-destructive">Today's progress could not load.</span> {getApiErrorMessage(streak.error, 'Please try again.')} ·{' '}
        <button type="button" onClick={() => void streak.refetch()} className={linkClass}>
          Try again
        </button>
      </p>
    );
  }

  const today = streak.data?.today;
  return (
    <section aria-label="Today" aria-busy={!today} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-base text-muted-foreground">
      {/* The spaces are for screen readers: between flex items they are not drawn. */}
      <p className="flex items-baseline gap-2">
        <span className="font-semibold leading-none tracking-widest text-primary/70">TODAY</span>{' '}
        <span className="text-xl font-black leading-none text-primary">{today?.sessions ?? '—'}</span> {plural(today?.sessions ?? 0, 'counted session')}
      </p>
      {today?.missionCompleted ? (
        <p className="text-primary">
          <CircleCheck className="mr-1.5 inline size-4 align-text-bottom" aria-hidden />
          Daily mission done
        </p>
      ) : (
        <p>
          Daily mission: {today ? Math.min(today.sessions, today.missionGoal) : '—'} / {today?.missionGoal ?? '—'}{' '}
          {plural(today?.missionGoal ?? 0, 'counted session')} ·{' '}
          <Link to="/typing" className={cn(linkClass, 'whitespace-nowrap')}>
            Practice now
          </Link>
        </p>
      )}
    </section>
  );
};
