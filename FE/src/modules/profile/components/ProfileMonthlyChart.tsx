import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { useMonthlyProgress } from '../hooks/use-profile';
import { longMonth, shortMonth } from '../lib/month-label';
import type { MonthlyProgressPoint } from '../types/profile.types';

// Colors are theme tokens only: the speed is the main red, the errors the muted text color (dashed, so the two lines are
// told apart without a second accent).
const WPM_COLOR = 'var(--primary)';
const ERRORS_COLOR = 'var(--muted-foreground)';
const AXIS_COLOR = 'var(--border)';

/** What the lines draw when there is no data at all: two flat lines at different heights, on axes that show no numbers. */
const PLACEHOLDER_WPM = 35;
const PLACEHOLDER_ERRORS = 65;

interface TooltipContentProps {
  point: MonthlyProgressPoint;
}

/** The tooltip of one month: both figures, and a note when they are the ones of the month before (no session that month). */
export const MonthlyChartTooltip = ({ point }: TooltipContentProps) => (
  <div className="border border-border bg-background px-3 py-2 text-base">
    <p className="font-semibold">{longMonth(point.month)}</p>
    {point.avgWpm === null || point.totalErrors === null ? (
      <p className="text-muted-foreground">Chưa có dữ liệu</p>
    ) : (
      <>
        <p>
          <span className="text-primary">WPM:</span> {point.avgWpm}
        </p>
        <p>
          <span className="text-muted-foreground">Số lỗi:</span> {point.totalErrors}
        </p>
        {point.carriedOver && <p className="text-muted-foreground">Không có phiên, giữ số liệu tháng trước</p>}
      </>
    )}
  </div>
);

/** A dot on a line: filled for a month with sessions, hollow for one that keeps the figures of the month before. */
const monthDot =
  (color: string) =>
  ({ cx, cy, payload, index }: { cx?: number; cy?: number; payload?: { carriedOver: boolean }; index?: number }) =>
    cx === undefined || cy === undefined ? (
      <g key={index} />
    ) : (
      <circle key={index} cx={cx} cy={cy} r={3.5} stroke={color} strokeWidth={2} fill={payload?.carriedOver ? 'var(--background)' : color} />
    );

const Legend = () => (
  <ul className="flex gap-4 text-base text-muted-foreground">
    <li className="flex items-center gap-2">
      <svg width="24" height="4" aria-hidden>
        <line x1="0" x2="24" y1="2" y2="2" stroke={WPM_COLOR} strokeWidth="2" />
      </svg>
      WPM
    </li>
    <li className="flex items-center gap-2">
      <svg width="24" height="4" aria-hidden>
        <line x1="0" x2="24" y1="2" y2="2" stroke={ERRORS_COLOR} strokeWidth="2" strokeDasharray="4 3" />
      </svg>
      Số lỗi
    </li>
  </ul>
);

/**
 * The learner's average WPM (left axis) and number of errors (right axis) of the 12 months before the current one
 * (SCRUM-240), on top of the profile. Without data the 12 months and two flat lines still show, with "Chưa có dữ liệu" over them.
 * No frame: it sits on the page like the rest of the header.
 */
export const ProfileMonthlyChart = () => {
  const query = useMonthlyProgress();

  if (query.isPending) return <LoadingState rows={1} />;
  if (query.isError) return <ErrorState error={query.error} title="Could not load the monthly chart" onRetry={() => query.refetch()} />;

  const months = query.data.months;
  const hasData = months.some((point) => point.avgWpm !== null);
  const data = months.map((point) => ({
    ...point,
    wpm: hasData ? point.avgWpm : PLACEHOLDER_WPM,
    errors: hasData ? point.totalErrors : PLACEHOLDER_ERRORS,
  }));
  // The numbers of the axes only mean something when the lines are real.
  const axisTick = hasData ? { fill: 'var(--muted-foreground)' } : false;

  return (
    <section aria-label="Monthly progress" className="w-full">
      <div
        role="img"
        aria-label={hasData ? 'Biểu đồ WPM và số lỗi theo 12 tháng' : 'Biểu đồ WPM và số lỗi theo 12 tháng, chưa có dữ liệu'}
        className="relative h-44"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={AXIS_COLOR} />
            <XAxis dataKey="month" tickFormatter={shortMonth} interval={0} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} stroke={AXIS_COLOR} />
            <YAxis
              yAxisId="wpm"
              width={hasData ? 36 : 8}
              domain={hasData ? [0, 'auto'] : [0, 100]}
              allowDecimals={false}
              tick={axisTick}
              stroke={AXIS_COLOR}
            />
            <YAxis
              yAxisId="errors"
              orientation="right"
              width={hasData ? 36 : 8}
              domain={hasData ? [0, 'auto'] : [0, 100]}
              allowDecimals={false}
              tick={axisTick}
              stroke={AXIS_COLOR}
            />
            {hasData && (
              <Tooltip
                cursor={{ stroke: AXIS_COLOR }}
                content={({ payload }) => (payload?.length ? <MonthlyChartTooltip point={payload[0].payload as MonthlyProgressPoint} /> : null)}
              />
            )}
            <Line
              yAxisId="wpm"
              dataKey="wpm"
              name="WPM"
              stroke={WPM_COLOR}
              strokeWidth={2}
              type="monotone"
              dot={hasData ? monthDot(WPM_COLOR) : false}
              activeDot={hasData}
              isAnimationActive={false}
            />
            <Line
              yAxisId="errors"
              dataKey="errors"
              name="Số lỗi"
              stroke={ERRORS_COLOR}
              strokeWidth={2}
              strokeDasharray="6 4"
              type="monotone"
              dot={hasData ? monthDot(ERRORS_COLOR) : false}
              activeDot={hasData}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
        {!hasData && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/40 text-base text-muted-foreground">
            Chưa có dữ liệu
          </p>
        )}
      </div>
      <Legend />
    </section>
  );
};
