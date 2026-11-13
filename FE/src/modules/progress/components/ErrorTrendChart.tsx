import { ClipboardCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { axisLabel, tooltipTitle } from '@/modules/profile/lib/month-label';
import type { ChartRange } from '@/modules/profile/types/profile.types';
import { errorLabels } from '@/modules/typing/typing.config';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { Button } from '@/shared/components/ui/button';
import type { SessionErrorType, TypingLanguage } from '@/shared/lib/typing-language';
import { useErrorTrend } from '../hooks/use-progress';
import { ERROR_TREND_STYLES, errorTrendTypes, hasNoTrend, shownTrendPoints } from '../lib/error-trend';
import type { ErrorTrendPoint } from '../types/progress.types';

const LINE_PADDING = { top: 4, bottom: 4 };
const TICK_SIZE = 16;
const AXIS_COLOR = 'var(--muted-foreground)';

interface ErrorTrendChartProps {
  range: ChartRange;
  /** A day: the chart shows the year, month or week that holds it (the same as the WPM chart). */
  date?: string;
  /** The language of the sessions: its error types are the lines (SCRUM-219). */
  language: TypingLanguage;
  /** The types whose line is hidden. */
  hidden: ReadonlySet<SessionErrorType>;
}

/** The tooltip of a column: the period and the rate of each line that shows. */
const TrendTooltip = ({ range, point, types, hidden }: { range: ChartRange; point: ErrorTrendPoint; types: SessionErrorType[]; hidden: ReadonlySet<SessionErrorType> }) => (
  <div className="border border-border bg-background px-3 py-2 text-base">
    <p className="font-semibold">{tooltipTitle(range, point.key)}</p>
    {types.filter((type) => !hidden.has(type)).map((type) => (
      <p key={type} className="flex items-center gap-2">
        <svg width="24" height="4" aria-hidden className="shrink-0">
          <line x1="0" x2="24" y1="2" y2="2" stroke={ERROR_TREND_STYLES[type].color} strokeWidth="2" strokeDasharray={ERROR_TREND_STYLES[type].dash} />
        </svg>
        <span className="text-muted-foreground">{errorLabels[type]}:</span> {point.rates[type] == null ? 'no chance' : `${point.rates[type]}%`}
      </p>
    ))}
  </div>
);

/**
 * The error rate of each Vietnamese error type over time (SCRUM-30): one line per type, over the same periods as the WPM chart
 * (Week, Month, Year), of the error set of one language (`GET /api/profile/error-trend`). A period without a chance of a type leaves a gap in its line.
 * No data yet: how to get some (the placement test).
 */
export const ErrorTrendChart = ({ range, date, language, hidden }: ErrorTrendChartProps) => {
  const query = useErrorTrend(range, language, date);
  const types = errorTrendTypes(language);

  if (query.isPending) return <LoadingState rows={1} />;
  if (query.isError) return <ErrorState error={query.error} title="Could not load the error rate chart" onRetry={() => query.refetch()} />;

  const shown = query.data.range;
  const points = shownTrendPoints(shown, query.data.points);
  if (hasNoTrend(points)) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="No error rates yet"
        description={language === 'en' ? 'Type an English passage in Practice: your first counted English session starts the chart.' : 'Take the placement test: your first counted session starts the chart.'}
        action={
          <Button asChild variant="outline" size="sm">
            {language === 'en' ? <Link to="/typing">Go to Practice</Link> : <Link to="/typing?mode=placement">Take the placement test</Link>}
          </Button>
        }
      />
    );
  }
  const data = points.map((point) => ({ ...point.rates, key: point.key, label: axisLabel(shown, point.key), point }));

  return (
    <section aria-label="Error rate by type" className="relative h-full w-full">
      <div role="img" aria-label={`Error rate of each error type by ${shown === 'year' ? 'month' : shown === 'month' ? 'week' : 'day'}`} className="relative h-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 28, bottom: 0, left: 28 }}>
            <XAxis dataKey="label" interval={0} tickLine={false} axisLine={{ stroke: 'var(--border)' }} height={32} tickSize={0} tickMargin={12} tick={{ fontSize: TICK_SIZE, fill: AXIS_COLOR }} />
            <YAxis padding={LINE_PADDING} width={60} tickMargin={12} domain={[0, 'auto']} tickFormatter={(value: number) => `${Math.round(value)}%`} allowDataOverflow tickLine={false} stroke="var(--border)" tick={{ fontSize: TICK_SIZE, fill: AXIS_COLOR }} />
            <Tooltip
              cursor={{ stroke: 'var(--border)' }}
              content={({ payload }) => (payload?.length ? <TrendTooltip range={shown} point={(payload[0].payload as { point: ErrorTrendPoint }).point} types={types} hidden={hidden} /> : null)}
            />
            {types.map((type) => (
              <Line
                key={type}
                dataKey={type}
                hide={hidden.has(type)}
                name={errorLabels[type]}
                stroke={ERROR_TREND_STYLES[type].color}
                strokeDasharray={ERROR_TREND_STYLES[type].dash}
                strokeWidth={2}
                type="monotone"
                dot={false}
                activeDot={{ r: 4, fill: ERROR_TREND_STYLES[type].color, stroke: ERROR_TREND_STYLES[type].color }}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
};
