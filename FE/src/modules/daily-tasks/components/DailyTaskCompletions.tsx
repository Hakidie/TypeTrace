import { Bar, BarChart, ReferenceLine, ResponsiveContainer, Tooltip, YAxis, type TooltipProps } from 'recharts';
import type { HourCompletions, TaskCompletions } from '../types/daily-task.types';

const HOUR_MS = 60 * 60 * 1000;

/** "14:00": a time in the admin's own zone. */
const clock = (time: number) => new Date(time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/** "Today 14:00–15:00", "Yesterday 23:00–00:00": the 24 hours are today's and yesterday's in the admin's own zone. */
const hourInWords = (hour: string) => {
  const start = new Date(hour).getTime();
  const day = new Date(start).toDateString() === new Date().toDateString() ? 'Today' : 'Yesterday';
  return `${day} ${clock(start)}–${clock(start + HOUR_MS)}`;
};

const learnersInWords = (count: number) => `${count} ${count === 1 ? 'learner' : 'learners'}`;

/** The tooltip of the hovered hour, in the look of the heatmap's: the learners first, then the hour. */
const HourTooltip = ({ active, payload }: TooltipProps<number, string>) => {
  const point = payload?.[0]?.payload as HourCompletions | undefined;
  if (!active || !point) return null;
  return (
    <div className="border border-border bg-background/75 px-2.5 py-1.5 text-sm whitespace-nowrap text-popover-foreground shadow-md backdrop-blur-xs">
      <p className="font-medium text-foreground">{learnersInWords(point.learners)}</p>
      <p className="text-muted-foreground">{hourInWords(point.hour)}</p>
    </div>
  );
};

/**
 * The learners who completed a task in each of the last 24 hours, where a session card has its `SessionLine`: small
 * columns without axes, one an hour with the current hour on the right, on a hairline baseline, 61px high like the stats
 * of a `ListRow`, each chart with a scale of its own (at least 3). The tooltip names the hovered hour and its learners;
 * screen readers get the hours that had some in words. A note instead while nobody completed the task in the 24 hours.
 */
export const DailyTaskCompletions = ({ completions }: { completions: TaskCompletions }) => {
  if (completions.learners === 0) {
    return <p className="flex h-[61px] items-center justify-center text-sm text-primary/70">Nobody completed it in the last 24 hours</p>;
  }
  const busyHours = completions.hours
    .filter((hour) => hour.learners > 0)
    .map((hour) => `${hourInWords(hour.hour)}: ${hour.learners}.`)
    .join(' ');
  return (
    <div
      role="img"
      aria-label={`Completed by ${learnersInWords(completions.learners)} in the last 24 hours. ${busyHours}`}
      className="h-[61px]"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={completions.hours} margin={{ top: 4, right: 0, bottom: 1, left: 0 }} barCategoryGap={2}>
          {/* At least 3 high: a lone learner is a short column, not a full one. */}
          <YAxis hide domain={[0, (dataMax: number) => Math.max(dataMax, 3)]} />
          <ReferenceLine y={0} stroke="var(--border)" />
          <Tooltip
            content={<HourTooltip />}
            cursor={{ fill: 'var(--primary)', fillOpacity: 0.15 }}
            allowEscapeViewBox={{ y: true }}
            wrapperStyle={{ zIndex: 50 }}
            isAnimationActive={false}
          />
          <Bar dataKey="learners" fill="var(--primary)" maxBarSize={24} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
