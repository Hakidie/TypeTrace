import { Calendar, CalendarDays, CalendarRange, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { anchorFor, periodLabel, periodOptions, periodValue } from '@/modules/profile/lib/chart-period';
import { axisLabel, rangeUnit, tooltipTitle } from '@/modules/profile/lib/month-label';
import type { ChartRange } from '@/modules/profile/types/profile.types';
import { CompactToolbar } from '@/shared/components/compact-toolbar';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { Panel } from '@/shared/components/panel';
import { dateKeyIn } from '@/shared/lib/local-date';
import { sectionTitleClass } from '@/shared/lib/panel-styles';
import { usePlanUsers } from '@/modules/plan/hooks/use-admin-plans';
import { PLAN_ZONE } from '@/modules/plan/plan.config';

// Week, Month, Year: the smallest first, as on the Progress page.
const RANGE_OPTIONS: { value: ChartRange; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];
const ICONS: Record<ChartRange, LucideIcon> = { year: Calendar, month: CalendarRange, week: CalendarDays };

const LINE_COLOR = 'var(--primary)';
const TICK_SIZE = 16;

/** The tooltip of a point: the period and how many users there are at its end. */
const PointTooltip = ({ label, total }: { label: string; total: number }) => (
  <div className="border border-border bg-background px-3 py-2 text-base">
    <p className="font-semibold">{label}</p>
    <p>
      <span className="text-primary">Total users:</span> {total}
    </p>
  </div>
);

/**
 * How many users there are over time, as a line chart built like the chart of the Plans page: a title and, in the look of the compact toolbar, Week,
 * Month and Year buttons, each with a menu of its own periods; under them one point for each period, the count at its end (users on any plan: Free + Premium).
 * The periods to come are not drawn. No frame or background.
 */
export const UsersChart = () => {
  const today = dateKeyIn(new Date(), PLAN_ZONE);
  const [range, setRange] = useState<ChartRange>('year');
  const [picked, setPicked] = useState<string | null>(null);
  const date = picked && picked <= today ? picked : today;
  const query = usePlanUsers(range, date);

  const renderChart = () => {
    if (query.isPending) return <LoadingState rows={1} />;
    if (query.isError) return <ErrorState error={query.error} title="Could not load the users chart" onRetry={() => void query.refetch()} />;
    const shown = query.data.range;
    const points = query.data.points;
    const data = points.map((point) => ({ key: point.key, label: axisLabel(shown, point.key), total: point.premium + point.free }));
    const top = Math.max(1, ...data.map((point) => point.total));
    const marks = [0, Math.round(top / 2), top].filter((mark, index, all) => all.indexOf(mark) === index);
    return (
      // The chart takes the height the page leaves it (at least 13rem): the box is positioned, so the chart reads its size from it.
      <div role="img" aria-label={`Users by ${rangeUnit(shown)}`} className="relative min-h-52 flex-1">
        <div className="absolute inset-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 28, bottom: 0, left: 28 }}>
              <XAxis dataKey="label" interval={0} tickLine={false} axisLine={{ stroke: 'var(--border)' }} height={32} tickSize={0} tickMargin={12} tick={{ fontSize: TICK_SIZE, fill: 'var(--muted-foreground)' }} />
              <YAxis padding={{ top: 4, bottom: 4 }} width={60} tickMargin={12} domain={[0, top]} ticks={marks} allowDecimals={false} tickLine={false} stroke="var(--border)" tick={{ fontSize: TICK_SIZE, fill: 'var(--muted-foreground)' }} />
              <Tooltip
                cursor={{ stroke: 'var(--border)' }}
                content={({ payload }) => (payload?.length ? <PointTooltip label={tooltipTitle(shown, payload[0].payload.key as string)} total={payload[0].payload.total as number} /> : null)}
              />
              <Line dataKey="total" name="Total users" stroke={LINE_COLOR} strokeWidth={2} type="monotone" dot={false} activeDot={{ r: 4, fill: LINE_COLOR, stroke: LINE_COLOR }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  return (
    <section aria-label="Users chart" className="flex min-h-0 flex-1 flex-col">
      <Panel
        title="Total users"
        bare
        fill
        titleClassName={sectionTitleClass}
        className="space-y-3"
        actions={
          <CompactToolbar
            menus={[
              ...RANGE_OPTIONS.map(({ value: menuRange, label }) => {
                const active = menuRange === range;
                return {
                  label,
                  icon: ICONS[menuRange],
                  valueLabel: periodLabel(menuRange, date),
                  active,
                  options: periodOptions(menuRange, date, today),
                  value: active ? periodValue(range, date) : '',
                  onChange: (value: string) => {
                    setRange(menuRange);
                    setPicked(anchorFor(menuRange, value, date, today));
                  },
                };
              }),
            ]}
          />
        }
      >
        {renderChart()}
      </Panel>
    </section>
  );
};
