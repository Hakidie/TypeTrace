import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EmptyState } from '@/shared/components/empty-state';
import { Panel } from '@/shared/components/panel';
import type { SessionTimeline } from '../types/typing.types';

const [WPM_LINE, ERRORS_LINE] = [
  { key: 'wpm', label: 'WPM', unit: '', axis: 'left', color: 'var(--primary)', dash: undefined },
  { key: 'errors', label: 'Error', unit: '', axis: 'right', color: 'var(--foreground)', dash: '6 4' },
] as const;

const LINES = [WPM_LINE, ERRORS_LINE] as const;

/** The axis lines have the color of the grid; their numbers and names are the muted text color, which stays readable on the dark theme. */
const AXIS_COLOR = 'var(--border)';
const AXIS_TEXT_COLOR = 'var(--muted-foreground)';

/** Ticks along the time axis, from 0 to `max`: every second, or in a round step (5, 10, ...) once there would be more than 60. */
const timeTicks = (max: number) => {
  const step = [1, 2, 5, 10, 15, 30, 60].find((candidate) => max / candidate <= 60) ?? 60;
  const ticks = Array.from({ length: Math.floor(max / step) + 1 }, (_, index) => index * step);
  return ticks[ticks.length - 1] === max ? ticks : [...ticks, max];
};

/** Line chart of the speed (WPM, solid, left axis) and the number of errors (dashed, right axis), one point per second (each over the last 10 seconds), over the time the learner chose (the axis ends there). */
interface SpeedErrorChartProps {
  timeline: SessionTimeline;
  timeLimitSeconds: number;
  /** Final WPM and accuracy (0-100) of the session, shown stacked on the right of the chart. */
  wpm?: number;
  accuracy?: number;
}

export const SpeedErrorChart = ({ timeline, timeLimitSeconds, wpm, accuracy }: SpeedErrorChartProps) => {
  // The last point can fall a moment after the chosen time (the server measures from the `begin` request): keep it on the axis.
  // The legend only shows while the pointer is over the chart.
  const [hovering, setHovering] = useState(false);
  const maxSecond = Math.max(timeLimitSeconds, Math.ceil(timeline.points[timeline.points.length - 1]?.second ?? 0));

  return (
    <Panel bare>
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1">
          {timeline.status === 'no_data' ? (
            <EmptyState title="Phiên này không có dữ liệu thời gian" />
          ) : timeline.status === 'too_short' ? (
            <EmptyState title="Phiên quá ngắn để vẽ biểu đồ" description="Gõ ít nhất 10 giây để thấy biểu đồ." />
          ) : (
            <div
              role="img"
              aria-label="Biểu đồ WPM và số lỗi theo thời gian"
              className="relative h-72"
              onMouseEnter={() => setHovering(true)}
              onMouseLeave={() => setHovering(false)}
            >
              <div className="h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeline.points} margin={{ top: 8, right: 0, bottom: 8, left: 0 }}>
                    <CartesianGrid stroke={AXIS_COLOR} />
                    <XAxis
                      dataKey="second"
                      type="number"
                      domain={[0, maxSecond]}
                      ticks={timeTicks(maxSecond)}
                          interval={0}
                      tick={{ fontSize: 16, fill: AXIS_TEXT_COLOR }}
                      stroke={AXIS_COLOR}
                    />
                    <YAxis
                      yAxisId="left"
                      width={52}
                      stroke={AXIS_COLOR}
                      tick={{ fill: AXIS_TEXT_COLOR }}
                      label={{ value: WPM_LINE.label, angle: -90, position: 'insideLeft', fill: AXIS_TEXT_COLOR }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      allowDecimals={false}
                      domain={[0, (dataMax: number) => Math.max(dataMax, 3)]}
                      width={44}
                      stroke={AXIS_COLOR}
                      tick={{ fill: AXIS_TEXT_COLOR }}
                      label={{ value: ERRORS_LINE.label, angle: 90, position: 'insideRight', fill: AXIS_TEXT_COLOR }}
                    />
                    <Tooltip
                      contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 0 }}
                      labelFormatter={(second) => `Giây thứ ${second}`}
                      formatter={(value, name, item) => [`${value}${LINES.find((line) => line.key === item.dataKey)?.unit ?? ''}`, name]}
                    />
                    {LINES.map(({ key, label, axis, color, dash }) => (
                      <Line
                        key={key}
                        yAxisId={axis}
                        dataKey={key}
                        name={label}
                        stroke={color}
                        strokeDasharray={dash}
                        type="monotone"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <ul
                aria-hidden={!hovering}
                className={`absolute bottom-10 right-16 flex gap-4 bg-background/70 px-2 py-1 text-sm transition-opacity ${hovering ? 'opacity-100' : 'opacity-0'}`}
              >
                {LINES.map(({ key, label, color, dash }) => (
                  <li key={key} className="flex items-center gap-2">
                    <svg width="24" height="4" aria-hidden>
                      <line x1="0" x2="24" y1="2" y2="2" stroke={color} strokeWidth="2" strokeDasharray={dash} />
                    </svg>
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        {/* The result of the whole session, stacked on the right of the chart, WPM at the top and ACC at the bottom of the chart area, time axis included (the legend only shows over the plot, bottom right, on hover, so it takes no row of its own); under it on a phone. */}
        <dl className="flex shrink-0 flex-row gap-6 lg:flex-col lg:justify-between lg:py-2">
          <div className="flex flex-1 flex-col items-end lg:flex-none">
            <dt className="text-2xl text-muted-foreground">WPM</dt>
            <dd className="text-[5rem] font-bold leading-none text-primary">{wpm}</dd>
          </div>
          <div className="flex flex-1 flex-col items-end lg:flex-none">
            <dt className="text-2xl text-muted-foreground">ACC</dt>
            <dd className="text-[5rem] font-bold leading-none text-primary">{accuracy}%</dd>
          </div>
        </dl>
      </div>
    </Panel>
  );
};
