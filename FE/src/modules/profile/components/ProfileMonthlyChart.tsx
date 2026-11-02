import { useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ErrorState } from '@/shared/components/error-state';
import { Tooltip as HintTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { LoadingState } from '@/shared/components/loading-state';
import { useMonthlyProgress, useMonthlyProgressSet } from '../hooks/use-profile';
import { axisLabel, previousPeriod, rangeUnit, tooltipTitle } from '../lib/month-label';
import { chartPoints, COMPARE_OPACITIES, compareColumns, lineDomain } from '../lib/monthly-chart';
import type { ChartCompare, ChartLines, ChartRange, MonthlyProgressPoint } from '../types/profile.types';

// Colors are theme tokens only: the speed is the main red, the accuracy the muted text color (dashed, so the two lines are
// told apart without a second accent).
const WPM_COLOR = 'var(--primary)';
const ACCURACY_COLOR = 'var(--muted-foreground)';
/** Room above and below the scales: a line on the lowest or the highest value would sit on the edge of the plot, where the chart cuts it in half (a thinner line). */
const LINE_PADDING = { top: 4, bottom: 4 };
/** The numbers and names on the axes are `text-base`: 1rem, 16px, like the tooltip. */
const TICK_SIZE = 16;
const CURSOR_COLOR = 'var(--border)';

/** A short stretch of a line of the chart, solid or dashed, in its color. */
const LineSample = ({ color, dashed = false, opacity = 1 }: { color: string; dashed?: boolean; opacity?: number }) => (
  <svg width="24" height="4" aria-hidden className="shrink-0">
    <line x1="0" x2="24" y1="2" y2="2" stroke={color} strokeWidth="2" strokeOpacity={opacity} strokeDasharray={dashed ? '4 3' : undefined} />
  </svg>
);

interface TooltipContentProps {
  point: MonthlyProgressPoint;
  range: ChartRange;
  /** Which figures to tell: the ones of the lines that show. */
  lines?: ChartLines;
}

/** The tooltip of one point: both figures, and a note when they are the ones of the period before (no session in this one). */
export const MonthlyChartTooltip = ({ point, range, lines = 'all' }: TooltipContentProps) => (
  <div className="border border-border bg-background px-3 py-2 text-base">
    <p className="font-semibold">{tooltipTitle(range, point.key)}</p>
    {point.avgWpm === null || point.avgAccuracy === null ? (
      <p className="text-muted-foreground">No data yet</p>
    ) : (
      <>
        {/* The sample of each line stands in for a legend: which line is which, where the figures are. */}
        {lines !== 'accuracy' && (
          <p className="flex items-center gap-2">
            <LineSample color={WPM_COLOR} />
            <span>
              <span className="text-primary">WPM:</span> {point.avgWpm}
            </span>
          </p>
        )}
        {lines !== 'wpm' && (
          <p className="flex items-center gap-2">
            <LineSample color={ACCURACY_COLOR} dashed />
            <span>
              <span className="text-muted-foreground">Accuracy:</span> {point.avgAccuracy}%
            </span>
          </p>
        )}
        {point.carriedOver && <p className="text-muted-foreground">No sessions: same figures as the {previousPeriod(range)} before</p>}
      </>
    )}
  </div>
);

/** The tooltip of a column of several periods: the figures of each, the ones added with fainter samples. */
export const ComparisonTooltip = ({ points, lines = 'all' }: { points: { point: MonthlyProgressPoint | null; range: ChartRange; opacity: number }[]; lines?: ChartLines }) => (
  <div className="border border-border bg-background px-3 py-2 text-base">
    {points.map(({ point, range, opacity }, index) =>
      point ? (
        <div key={index} className={index > 0 ? 'mt-2' : undefined}>
          <p className="font-semibold">{tooltipTitle(range, point.key)}</p>
          {point.avgWpm === null || point.avgAccuracy === null ? (
            <p className="text-muted-foreground">No data</p>
          ) : (
            <>
              {lines !== 'accuracy' && (
                <p className="flex items-center gap-2">
                  <LineSample color={WPM_COLOR} opacity={opacity} />
                  <span>
                    <span className="text-primary">WPM:</span> {point.avgWpm}
                  </span>
                </p>
              )}
              {lines !== 'wpm' && (
                <p className="flex items-center gap-2">
                  <LineSample color={ACCURACY_COLOR} dashed opacity={opacity} />
                  <span>
                    <span className="text-muted-foreground">Accuracy:</span> {point.avgAccuracy}%
                  </span>
                </p>
              )}
            </>
          )}
        </div>
      ) : null,
    )}
  </div>
);

/** The name of a Y axis, written upright along it (the left one reads from the bottom up, the right one from the top down), centered on the plot, with a hint (the shared tooltip) of what the lowest value of that axis is. */
const AxisCaption = ({ name, hint, side }: { name: string; hint: string; side: 'left' | 'right' }) => (
  <div className={`absolute bottom-8 top-2 flex items-center ${side === 'left' ? 'left-0' : 'right-0'}`}>
    <HintTooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className={`cursor-help text-base text-muted-foreground [writing-mode:vertical-rl] ${side === 'left' ? 'rotate-180' : ''}`}>
          {name}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 whitespace-normal">{hint}</TooltipContent>
    </HintTooltip>
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
  /** Years, months or weeks put on the chart next to its own: it also draws their lines, fainter, column by column on top of the first (Progress page, the + button), at most `COMPARE_OPACITIES.length`. */
  compare?: ChartCompare[];
  /** Shows the three axes all the time (not only on hover): WPM on the left, accuracy on the right, each from the lowest value of its line to the highest, and the names under the lines (Progress page). Without it only the names show. */
  axes?: boolean;
  /** Which lines show: both (default), only the WPM or only the accuracy (Progress page). The other line and its axis are hidden, not removed, so nothing moves. */
  lines?: ChartLines;
  /** The height of the chart, as Tailwind classes; the header gives it the height of its row from `lg` (`h-44 lg:h-full`). */
  heightClassName?: string;
}

export const ProfileMonthlyChart = ({ range, date, compare = [], axes = false, lines = 'all', heightClassName = 'h-44 lg:h-full' }: ProfileMonthlyChartProps) => {
  const query = useMonthlyProgress(range, date);
  const comparing = compare.length > 0;
  const others = useMonthlyProgressSet(compare);
  const [hovering, setHovering] = useState(false);

  if (query.isPending) return <LoadingState rows={1} />;
  if (query.isError) return <ErrorState error={query.error} title="Could not load the monthly chart" onRetry={() => query.refetch()} />;
  if (others.some((other) => other.isPending)) return <LoadingState rows={1} />;
  const failed = others.find((other) => other.isError);
  if (failed) return <ErrorState error={failed.error} title="Could not load a period to compare" onRetry={() => failed.refetch()} />;

  // The names under the chart follow the range of the points on screen: while another range loads, the previous one stays (`placeholderData`).
  const shown = query.data.range;
  // One period: from the first placement on (every point while there is no data). Several: whole, by position, so the columns line up.
  const columns = comparing
    ? compareColumns(query.data.points, others.map((other) => other.data?.points ?? []))
    : chartPoints(query.data.points).map((point) => ({ main: point, others: [] as (MonthlyProgressPoint | null)[] }));
  const hasData = columns.some((column) => column.main?.avgWpm != null || column.others.some((point) => point?.avgWpm != null));
  // Without data both lines are flat at 0, one on the other, over the points of the range.
  const data = columns.map((column, index) => {
    const row: Record<string, unknown> = {
      key: column.main?.key ?? String(index),
      // The periods put on the chart may start on other days of the week: a week's columns are numbered, not named.
      label: comparing && shown === 'week' ? `D${index + 1}` : axisLabel(shown, column.main?.key ?? column.others.find(Boolean)?.key ?? ''),
      main: column.main,
      others: column.others,
      wpm: hasData ? (column.main?.avgWpm ?? null) : 0,
      accuracy: hasData ? (column.main?.avgAccuracy ?? null) : 0,
    };
    column.others.forEach((point, other) => {
      row[`wpm${other + 1}`] = point?.avgWpm ?? null;
      row[`accuracy${other + 1}`] = point?.avgAccuracy ?? null;
    });
    return row;
  });
  // Each line is scaled from its own lowest value to its highest (with the periods put on it), axes or not. Without data both lines are flat at 0, one on the other.
  const wpmDomain = lineDomain(data.flatMap((row) => [row.wpm as number | null, ...compare.map((_, other) => row[`wpm${other + 1}`] as number | null)]));
  const accuracyDomain = lineDomain(data.flatMap((row) => [row.accuracy as number | null, ...compare.map((_, other) => row[`accuracy${other + 1}`] as number | null)]));
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
        aria-label={`WPM and accuracy by ${rangeUnit(shown)}${comparing ? ', with other periods' : ''}${hasData ? '' : ', no data yet'}`}
        className={`relative ${heightClassName}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: axes ? 28 : 20, bottom: 0, left: axes ? 28 : 20 }}>
            {/* No axis on screen but the names under the lines, only while the pointer is over the chart (their space is always there, so the lines
                do not move). The side margin keeps the first and the last name (MON, W5, DEC), centered on their point and wider than 24px, from being cut. */}
            <XAxis
              dataKey="label"
              interval={0}
              tickLine={false}
              axisLine={axes ? { stroke: axisLine } : false}
              height={axes ? 32 : 24}
              tickSize={0}
              tickMargin={axes ? 12 : 4}
              tick={{ fontSize: TICK_SIZE, fill: axisText }}
            />
            {axes ? (
              <YAxis yAxisId="wpm" hide={lines === 'accuracy'} padding={LINE_PADDING} width={60} tickMargin={12} domain={wpmDomain} ticks={marksOf(wpmDomain)} tickFormatter={(value: number) => String(Math.round(value))} allowDataOverflow tickLine={false} stroke={axisLine} tick={{ fontSize: TICK_SIZE, fill: axisText }} />
            ) : (
              <YAxis yAxisId="wpm" hide padding={LINE_PADDING} domain={wpmDomain} />
            )}
            {axes ? (
              <YAxis
                yAxisId="accuracy"
                hide={lines === 'wpm'}
                padding={LINE_PADDING}
                orientation="right"
                width={72}
                tickMargin={12}
                domain={accuracyDomain}
                ticks={marksOf(accuracyDomain)}
                tickFormatter={(value: number) => `${Math.round(value)}%`}
                allowDataOverflow
                tickLine={false}
                stroke={axisLine}
                tick={{ fontSize: TICK_SIZE, fill: axisText }}
              />
            ) : (
              <YAxis yAxisId="accuracy" hide padding={LINE_PADDING} domain={accuracyDomain} />
            )}
            {hasData && (
              <Tooltip
                cursor={{ stroke: CURSOR_COLOR }}
                content={({ payload }) => {
                  if (!payload?.length) return null;
                  const column = payload[0].payload as { main: MonthlyProgressPoint | null; others: (MonthlyProgressPoint | null)[] };
                  if (comparing) {
                    return (
                      <ComparisonTooltip
                        lines={lines}
                        points={[
                          { point: column.main, range: shown, opacity: 1 },
                          ...column.others.map((point, other) => ({ point, range: compare[other].range, opacity: COMPARE_OPACITIES[other] })),
                        ]}
                      />
                    );
                  }
                  return column.main ? <MonthlyChartTooltip point={column.main} range={shown} lines={lines} /> : null;
                }}
              />
            )}
            <Line
              yAxisId="wpm"
              dataKey="wpm"
              hide={lines === 'accuracy'}
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
              hide={lines === 'wpm'}
              name="Accuracy"
              stroke={ACCURACY_COLOR}
              strokeWidth={2}
              strokeDasharray="6 4"
              type="monotone"
              dot={false}
              activeDot={hasData ? { r: 4, fill: ACCURACY_COLOR, stroke: ACCURACY_COLOR } : false}
              isAnimationActive={false}
            />
            {compare.flatMap((_, other) => [
              <Line
                key={`wpm${other + 1}`}
                yAxisId="wpm"
                dataKey={`wpm${other + 1}`}
                hide={lines === 'accuracy'}
                name={`WPM (${other + 2})`}
                stroke={WPM_COLOR}
                strokeOpacity={COMPARE_OPACITIES[other]}
                strokeWidth={2}
                type="monotone"
                dot={false}
                activeDot={{ r: 4, fill: WPM_COLOR, stroke: WPM_COLOR, fillOpacity: COMPARE_OPACITIES[other] }}
                isAnimationActive={false}
              />,
              <Line
                key={`accuracy${other + 1}`}
                yAxisId="accuracy"
                dataKey={`accuracy${other + 1}`}
                hide={lines === 'wpm'}
                name={`Accuracy (${other + 2})`}
                stroke={ACCURACY_COLOR}
                strokeOpacity={COMPARE_OPACITIES[other]}
                strokeWidth={2}
                strokeDasharray="6 4"
                type="monotone"
                dot={false}
                activeDot={{ r: 4, fill: ACCURACY_COLOR, stroke: ACCURACY_COLOR, fillOpacity: COMPARE_OPACITIES[other] }}
                isAnimationActive={false}
              />,
            ])}
          </LineChart>
        </ResponsiveContainer>
        {/* The names of the two Y axes, upright at the sides (the 28px margin of the chart is their room), each with a hint of what the bottom of its axis is. */}
        {axes && hasData && (
          <TooltipProvider delayDuration={200}>
            {lines !== 'accuracy' && (
              <AxisCaption
                name="WPM"
                side="left"
                hint={`The bottom of this axis is ${Math.round(wpmDomain[0])}, the lowest WPM on the chart, not 0. The top is the highest WPM.`}
              />
            )}
            {lines !== 'wpm' && (
              <AxisCaption
                name="Accuracy"
                side="right"
                hint={`The bottom of this axis is ${Math.round(accuracyDomain[0])}%, the lowest accuracy on the chart, not 0%. The top is the highest accuracy.`}
              />
            )}
          </TooltipProvider>
        )}
        {!hasData && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-base text-muted-foreground">
            No data yet
          </p>
        )}
      </div>
    </section>
  );
};
