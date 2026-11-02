import { useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { useMonthlyProgress } from '../hooks/use-profile';
import { axisLabel, previousPeriod, rangeUnit, tooltipTitle } from '../lib/month-label';
import { chartPoints, lineDomain } from '../lib/monthly-chart';
import type { ChartRange, MonthlyProgressPoint } from '../types/profile.types';

// Colors are theme tokens only: the speed is the main red, the accuracy the muted text color (dashed, so the two lines are
// told apart without a second accent).
const WPM_COLOR = 'var(--primary)';
const ACCURACY_COLOR = 'var(--muted-foreground)';
/** Room above and below the scales: a line on the lowest or the highest value would sit on the edge of the plot, where the chart cuts it in half (a thinner line). */
const LINE_PADDING = { top: 4, bottom: 4 };
const CURSOR_COLOR = 'var(--border)';

/** A short stretch of a line of the chart, solid or dashed, in its color. */
const LineSample = ({ color, dashed = false }: { color: string; dashed?: boolean }) => (
  <svg width="24" height="4" aria-hidden className="shrink-0">
    <line x1="0" x2="24" y1="2" y2="2" stroke={color} strokeWidth="2" strokeDasharray={dashed ? '4 3' : undefined} />
  </svg>
);

interface TooltipContentProps {
  point: MonthlyProgressPoint;
  range: ChartRange;
}

/** The tooltip of one point: both figures, and a note when they are the ones of the period before (no session in this one). */
export const MonthlyChartTooltip = ({ point, range }: TooltipContentProps) => (
  <div className="border border-border bg-background px-3 py-2 text-base">
    <p className="font-semibold">{tooltipTitle(range, point.key)}</p>
    {point.avgWpm === null || point.avgAccuracy === null ? (
      <p className="text-muted-foreground">No data yet</p>
    ) : (
      <>
        {/* The sample of each line stands in for a legend: which line is which, where the figures are. */}
        <p className="flex items-center gap-2">
          <LineSample color={WPM_COLOR} />
          <span>
            <span className="text-primary">WPM:</span> {point.avgWpm}
          </span>
        </p>
        <p className="flex items-center gap-2">
          <LineSample color={ACCURACY_COLOR} dashed />
          <span>
            <span className="text-muted-foreground">Accuracy:</span> {point.avgAccuracy}%
          </span>
        </p>
        {point.carriedOver && <p className="text-muted-foreground">No sessions: same figures as the {previousPeriod(range)} before</p>}
      </>
    )}
  </div>
);

/**
 * The learner's average WPM and accuracy by month (`year`), by week of this month (`month`) or by day (`week`)
 * (SCRUM-240; the Progress page picks the range and, with `date`, the year, month or week; the profile header shows the last 7 days). No dots on the lines: only the point under the pointer shows one, under the bio on the profile, as wide as the header (176px high; from `lg` it fills the row the header gives it), from the month of the first counted placement to the current month. No axis lines or numbers; the names (JAN, W1, MON, ...) under the lines show while the pointer is over the chart; the tooltip of a point names the lines. Each line is
 * scaled from its own lowest value to its own highest (`lineDomain`). Without data every point of the range and two flat lines at 0, one on the other,
 * still show, with "No data yet" over them. No frame: it sits on the page like the rest of the header.
 */
interface ProfileMonthlyChartProps {
  /** The range shown. */
  range: ChartRange;
  /** A day ('YYYY-MM-DD'): the chart shows the year, month or week that holds it (Progress page). Without it the range ends now (the profile header: the last 7 days). */
  date?: string;
  /** Shows the three axes all the time (not only on hover): WPM on the left, accuracy on the right, each from the lowest value of its line to the highest, and the names under the lines (Progress page). Without it only the names show. */
  axes?: boolean;
  /** The height of the chart, as Tailwind classes; the header gives it the height of its row from `lg` (`h-44 lg:h-full`). */
  heightClassName?: string;
}

export const ProfileMonthlyChart = ({ range, date, axes = false, heightClassName = 'h-44 lg:h-full' }: ProfileMonthlyChartProps) => {
  const query = useMonthlyProgress(range, date);
  const [hovering, setHovering] = useState(false);

  if (query.isPending) return <LoadingState rows={1} />;
  if (query.isError) return <ErrorState error={query.error} title="Could not load the monthly chart" onRetry={() => query.refetch()} />;
  // The names under the chart follow the range of the points on screen: while another range loads, the previous one stays (`placeholderData`).
  const shown = query.data.range;
  // From the first placement on; every point while there is no data.
  const months = chartPoints(query.data.points);
  const hasData = months.some((point) => point.avgWpm !== null);
  // Without data both lines are flat at 0, one on the other, over the points of the range.
  const data = months.map((point) => ({
    ...point,
    wpm: hasData ? point.avgWpm : 0,
    accuracy: hasData ? point.avgAccuracy : 0,
  }));
  // Each line is scaled from its own lowest value to its highest, axes or not. Without data both lines are flat at 0, one on the other.
  const wpmDomain = lineDomain(data.map((point) => point.wpm));
  const accuracyDomain = lineDomain(data.map((point) => point.accuracy));
  // The marks of an axis: the lowest value, the middle and the highest of its line.
  const marksOf = ([low, high]: [number, number]) => [low, (low + high) / 2, high];
  const axisShown = hasData && (axes || hovering);
  const axisText = axisShown ? 'var(--muted-foreground)' : 'transparent';
  const axisLine = axisShown ? 'var(--border)' : 'transparent';

  return (
    <section
      aria-label="Monthly progress"
      className="relative h-full w-full"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div
        role="img"
        aria-label={hasData ? `WPM and accuracy by ${rangeUnit(shown)}` : `WPM and accuracy by ${rangeUnit(shown)}, no data yet`}
        className={`relative ${heightClassName}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: axes ? 0 : 20, bottom: 0, left: axes ? 0 : 20 }}>
            {/* No axis on screen but the names under the lines, only while the pointer is over the chart (their space is always there, so the lines
                do not move). The side margin keeps the first and the last name (MON, W5, DEC), centered on their point and wider than 24px, from being cut. */}
            <XAxis
              dataKey="key"
              tickFormatter={(key: string) => axisLabel(shown, key)}
              interval={0}
              tickLine={false}
              axisLine={axes ? { stroke: axisLine } : false}
              height={20}
              tick={{ fontSize: 12, fill: axisText }}
            />
            {axes ? (
              <YAxis yAxisId="wpm" padding={LINE_PADDING} width={32} domain={wpmDomain} ticks={marksOf(wpmDomain)} tickFormatter={(value: number) => String(Math.round(value))} allowDataOverflow tickLine={false} stroke={axisLine} tick={{ fontSize: 12, fill: axisText }} />
            ) : (
              <YAxis yAxisId="wpm" hide padding={LINE_PADDING} domain={wpmDomain} />
            )}
            {axes ? (
              <YAxis
                yAxisId="accuracy"
                padding={LINE_PADDING}
                orientation="right"
                width={40}
                domain={accuracyDomain}
                ticks={marksOf(accuracyDomain)}
                tickFormatter={(value: number) => `${Math.round(value)}%`}
                allowDataOverflow
                tickLine={false}
                stroke={axisLine}
                tick={{ fontSize: 12, fill: axisText }}
              />
            ) : (
              <YAxis yAxisId="accuracy" hide padding={LINE_PADDING} domain={accuracyDomain} />
            )}
            {hasData && (
              <Tooltip
                cursor={{ stroke: CURSOR_COLOR }}
                content={({ payload }) => (payload?.length ? <MonthlyChartTooltip point={payload[0].payload as MonthlyProgressPoint} range={shown} /> : null)}
              />
            )}
            <Line
              yAxisId="wpm"
              dataKey="wpm"
              name="WPM"
              stroke={WPM_COLOR}
              strokeWidth={2}
              type="monotone"
              dot={false}
              activeDot={hasData ? { r: 4, fill: WPM_COLOR, stroke: WPM_COLOR } : false}
              isAnimationActive={false}
            />
            <Line
              yAxisId="accuracy"
              dataKey="accuracy"
              name="Accuracy"
              stroke={ACCURACY_COLOR}
              strokeWidth={2}
              strokeDasharray="6 4"
              type="monotone"
              dot={false}
              activeDot={hasData ? { r: 4, fill: ACCURACY_COLOR, stroke: ACCURACY_COLOR } : false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
        {!hasData && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-base text-muted-foreground">
            No data yet
          </p>
        )}
      </div>
    </section>
  );
};
