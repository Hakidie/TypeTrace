import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts';
import type { SessionTimeline } from '@/modules/typing/types/typing.types';

/** Speed (WPM, solid) and number of errors (dashed) of a session over time as small lines without axes (each with a scale of its own, like the result chart), 61px high like the avatar tile and the stats of a `ListRow`. A note instead when there is no line to draw. */
export const SessionLine = ({ timeline }: { timeline: SessionTimeline }) => {
  if (timeline.status !== 'ok') {
    return (
      <p className="flex h-[61px] items-center justify-center text-sm text-primary/70">
        {timeline.status === 'too_short' ? 'Too short to draw a speed line' : 'No time data for this session'}
      </p>
    );
  }
  return (
    <div role="img" aria-label="Speed and errors over time" className="h-[61px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={timeline.points} margin={{ top: 4, right: 0, bottom: 4, left: 0 }}>
          <YAxis hide yAxisId="left" domain={[0, (dataMax: number) => Math.max(dataMax, 1)]} />
          <YAxis hide yAxisId="right" domain={[0, (dataMax: number) => Math.max(dataMax, 3)]} />
          <Line yAxisId="left" dataKey="wpm" stroke="var(--primary)" strokeWidth={2} type="monotone" dot={false} isAnimationActive={false} />
          <Line yAxisId="right" dataKey="errors" stroke="var(--foreground)" strokeWidth={2} strokeDasharray="6 4" type="monotone" dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
