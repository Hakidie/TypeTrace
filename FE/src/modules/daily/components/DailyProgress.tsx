import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { cn } from '@/shared/lib/utils';
import { useDailyHistory } from '../hooks/use-daily';
import type { DailyDayResult } from '../types/daily.types';
import { dailyGlass } from './DailyCard';

/** Grid and axis lines in the border color, their text muted (readable on both themes), as on the result chart. */
const AXIS_COLOR = 'var(--border)';
const AXIS_TEXT_COLOR = 'var(--muted-foreground)';

const dayLabel = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const signed = (value: number, digits: number) => `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;

type Measure = 'wpm' | 'accuracy';
const MEASURES: Record<Measure, { label: string; unit: string; digits: number; domain: [number | ((min: number) => number), number | 'auto'] }> = {
  wpm: { label: 'WPM', unit: '', digits: 0, domain: [0, 'auto'] },
  // Accuracy sits near the top: the axis starts a little under the lowest day, so a change of a point or two shows.
  accuracy: { label: 'Accuracy', unit: '%', digits: 1, domain: [(min: number) => Math.max(0, Math.floor(min - 5)), 100] },
};

/** The value of the last daily and its change since the one before, with an arrow and a sign (never the color alone). */
const Change = ({ measure, last, previous }: { measure: Measure; last: DailyDayResult; previous?: DailyDayResult }) => {
  const { label, unit, digits } = MEASURES[measure];
  const value = last[measure]!;
  const delta = previous ? value - previous[measure]! : null;
  const Icon = delta === null || Math.abs(delta) < 10 ** -digits / 2 ? Minus : delta > 0 ? ArrowUp : ArrowDown;
  return (
    <div className="flex flex-col gap-1 bg-card/60 p-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span aria-label={`${label}, last daily`} className="text-2xl font-black tabular-nums">
        {value.toFixed(digits)}
        {unit}
      </span>
      {delta !== null && previous && (
        <span className={cn('flex items-center gap-1 text-sm', delta > 0 ? 'text-primary' : 'text-muted-foreground')}>
          <Icon className="size-4" aria-hidden="true" />
          {signed(delta, digits)} vs {dayLabel(previous.date)}
        </span>
      )}
    </div>
  );
};

/** One measure over the days: a thin line with a dot on each day played and a gap on a day without a try, one axis. */
const DayLine = ({ days, measure }: { days: DailyDayResult[]; measure: Measure }) => {
  const { label, unit, digits, domain } = MEASURES[measure];
  return (
    <div role="img" aria-label={`${label} of each daily`} className="h-32">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={days} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={AXIS_COLOR} vertical={false} />
          <XAxis dataKey="date" tickFormatter={dayLabel} tick={{ fontSize: 12, fill: AXIS_TEXT_COLOR }} stroke={AXIS_COLOR} interval="preserveStartEnd" minTickGap={16} />
          <YAxis width={40} domain={domain} allowDecimals={false} tick={{ fontSize: 12, fill: AXIS_TEXT_COLOR }} stroke={AXIS_COLOR} />
          <Tooltip
            cursor={{ stroke: AXIS_TEXT_COLOR, strokeDasharray: '3 3' }}
            contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 0, color: 'var(--foreground)' }}
            labelFormatter={(date) => dayLabel(String(date))}
            formatter={(value) => [`${Number(value).toFixed(digits)}${unit}`, label]}
          />
          <Line
            dataKey={measure}
            name={label}
            stroke="var(--primary)"
            strokeWidth={2}
            dot={{ r: 4, fill: 'var(--primary)', stroke: 'var(--background)', strokeWidth: 2 }}
            activeDot={{ r: 6, stroke: 'var(--background)', strokeWidth: 2 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

/**
 * The learner's progress in the daily challenge: the WPM and accuracy of their best try each day for the last two weeks
 * (two charts: the two measures have different scales, so they never share an axis), the change since the daily before,
 * and the same numbers as a table for screen readers.
 */
export const DailyProgress = () => {
  const history = useDailyHistory();

  return (
    <section aria-label="Your progress" className={cn('flex flex-col gap-4 p-5', dailyGlass)}>
      <h2 className="text-lg font-semibold text-foreground">Your progress</h2>
      {history.isLoading ? (
        <LoadingState rows={2} />
      ) : history.isError ? (
        <ErrorState error={history.error} onRetry={() => history.refetch()} />
      ) : (
        <Progress days={history.data ?? []} />
      )}
    </section>
  );
};

const Progress = ({ days }: { days: DailyDayResult[] }) => {
  const played = days.filter((day) => day.wpm !== null);
  if (!played.length) return <EmptyState title="No daily tries yet" description="Your WPM and accuracy of each day show up here." />;
  const last = played[played.length - 1];
  const previous = played[played.length - 2];
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Change measure="wpm" last={last} previous={previous} />
        <Change measure="accuracy" last={last} previous={previous} />
      </div>
      {!previous && <p className="text-sm text-muted-foreground">Come back tomorrow to see your progress</p>}
      <div aria-hidden="true" className="grid gap-2 sm:grid-cols-2">
        <div>
          <p className="text-sm text-muted-foreground">WPM</p>
          <DayLine days={days} measure="wpm" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Accuracy</p>
          <DayLine days={days} measure="accuracy" />
        </div>
      </div>
      <table aria-label="Daily results" className="sr-only">
        <thead>
          <tr>
            <th>Day</th>
            <th>WPM</th>
            <th>Accuracy</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {played.map((day) => (
            <tr key={day.date}>
              <td>{dayLabel(day.date)}</td>
              <td>{Math.round(day.wpm!)}</td>
              <td>{day.accuracy}%</td>
              <td>{day.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
};
