import { Calendar, CalendarDays, CalendarRange, ChartLine, type LucideIcon } from 'lucide-react';
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
import { usePlanUsers } from '../hooks/use-admin-plans';
import { LINES_OPTIONS, PLAN_ZONE, type PlanLines } from '../plan.config';
import type { PlanUsersPoint } from '../types/plan.types';

// Week, Month, Year: the smallest first, as on the Progress page.
const RANGE_OPTIONS: { value: ChartRange; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];
const ICONS: Record<ChartRange, LucideIcon> = { year: Calendar, month: CalendarRange, week: CalendarDays };

// Theme tokens only, as the chart of the Progress page: Premium is the main red line, Free the muted text color, dashed.
const PREMIUM_COLOR = 'var(--primary)';
const FREE_COLOR = 'var(--muted-foreground)';
const LINE_PADDING = { top: 4, bottom: 4 };
const TICK_SIZE = 16;

const LineSample = ({ color, dashed = false }: { color: string; dashed?: boolean }) => (
  <svg width="24" height="4" aria-hidden className="shrink-0">
    <line x1="0" x2="24" y1="2" y2="2" stroke={color} strokeWidth="2" strokeDasharray={dashed ? '4 3' : undefined} />
  </svg>
);

/** The tooltip of a point: the period and how many users are on each plan at its end. */
const PointTooltip = ({ point, range, lines }: { point: PlanUsersPoint; range: ChartRange; lines: PlanLines }) => (
  <div className="border border-border bg-background px-3 py-2 text-base">
    <p className="font-semibold">{tooltipTitle(range, point.key)}</p>
    {lines !== 'free' && (
      <p className="flex items-center gap-2">
        <LineSample color={PREMIUM_COLOR} />
        <span>
          <span className="text-primary">Premium:</span> {point.premium}
        </span>
      </p>
    )}
    {lines !== 'premium' && (
      <p className="flex items-center gap-2">
        <LineSample color={FREE_COLOR} dashed />
        <span>
          <span className="text-muted-foreground">Free:</span> {point.free}
        </span>
      </p>
    )}
  </div>
);

/**
 * How many users are on each plan over time (US11.1), built like the chart of the Progress page: a title and, in the look of the compact toolbar, Week,
 * Month and Year buttons, each with a menu of its own periods, and a Lines button next to them (All, Premium, Free); under them a line chart with the axes' numbers (the same Y axis for both lines: they are counts of
 * users, so they can be compared), Premium solid and Free dashed. Each point is the count at the end of its period; the periods to come are not drawn. No frame or background.
 */
export const PlanUsersChart = ({ lines, onLinesChange }: { lines: PlanLines; onLinesChange: (lines: PlanLines) => void }) => {
  const today = dateKeyIn(new Date(), PLAN_ZONE);
  const [range, setRange] = useState<ChartRange>('year');
  const [picked, setPicked] = useState<string | null>(null);
  const date = picked && picked <= today ? picked : today;
  // `lines` (both, only Premium or only Free) is kept by the page, since a click on a plan card sets it too. The scale follows the lines that show.
  const query = usePlanUsers(range, date);

  const renderChart = () => {
    if (query.isPending) return <LoadingState rows={1} />;
    if (query.isError) return <ErrorState error={query.error} title="Could not load the users chart" onRetry={() => void query.refetch()} />;
    const shown = query.data.range;
    const points = query.data.points;
    const top = Math.max(1, ...points.map((point) => Math.max(lines === 'free' ? 0 : point.premium, lines === 'premium' ? 0 : point.free)));
    const marks = [0, Math.round(top / 2), top].filter((mark, index, all) => all.indexOf(mark) === index);
    const data = points.map((point) => ({ ...point, label: axisLabel(shown, point.key) }));
    return (
      // The chart takes the height the page leaves it (at least 20rem): the box is positioned, so the chart reads its size from it.
      <div role="img" aria-label={`Users on each plan by ${rangeUnit(shown)}`} className="relative min-h-80 flex-1">
        <div className="absolute inset-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 28, bottom: 0, left: 28 }}>
              <XAxis dataKey="label" interval={0} tickLine={false} axisLine={{ stroke: 'var(--border)' }} height={32} tickSize={0} tickMargin={12} tick={{ fontSize: TICK_SIZE, fill: 'var(--muted-foreground)' }} />
              <YAxis padding={LINE_PADDING} width={60} tickMargin={12} domain={[0, top]} ticks={marks} allowDecimals={false} tickLine={false} stroke="var(--border)" tick={{ fontSize: TICK_SIZE, fill: 'var(--muted-foreground)' }} />
              <Tooltip
                cursor={{ stroke: 'var(--border)' }}
                content={({ payload }) => (payload?.length ? <PointTooltip point={payload[0].payload as PlanUsersPoint} range={shown} lines={lines} /> : null)}
              />
              <Line dataKey="premium" hide={lines === 'free'} name="Premium" stroke={PREMIUM_COLOR} strokeWidth={2} type="monotone" dot={false} activeDot={{ r: 4, fill: PREMIUM_COLOR, stroke: PREMIUM_COLOR }} isAnimationActive={false} />
              <Line dataKey="free" hide={lines === 'premium'} name="Free" stroke={FREE_COLOR} strokeWidth={2} strokeDasharray="6 4" type="monotone" dot={false} activeDot={{ r: 4, fill: FREE_COLOR, stroke: FREE_COLOR }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  return (
    <section aria-label="Users by plan" className="flex min-h-0 flex-1 flex-col">
      <Panel
        title="Users"
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
              // Next to Year: which lines the chart draws.
              {
                label: 'Lines',
                icon: ChartLine,
                valueLabel: LINES_OPTIONS.find((option) => option.value === lines)!.label,
                options: LINES_OPTIONS,
                value: lines,
                onChange: (value: string) => onLinesChange(value as PlanLines),
              },
            ]}
          />
        }
      >
        {renderChart()}
      </Panel>
    </section>
  );
};
