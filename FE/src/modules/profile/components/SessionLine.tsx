import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts';
import { ErrorMark } from '@/modules/typing/components/ErrorMark';
import type { SessionTimeline } from '@/modules/typing/types/typing.types';

/** Speed (WPM) of a session over time as a small line without axes, with a cross on every second a wrong word was typed (like the result chart), 61px high like the avatar tile and the stats of a `ListRow`. A note instead when there is no line to draw. */
export const SessionLine = ({ timeline }: { timeline: SessionTimeline }) => {
  if (timeline.status !== 'ok') {
    return (
      <p className="flex h-[61px] items-center justify-center text-sm text-primary/70">
        {timeline.status === 'too_short' ? 'Too short to draw a speed line' : 'No time data for this session'}
      </p>
    );
  }
  return (
    <div role="img" aria-label="Speed over time, with a cross at each second with an error" className="h-[61px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={timeline.points} margin={{ top: 4, right: 0, bottom: 4, left: 0 }}>
          <YAxis hide domain={[0, (dataMax: number) => Math.max(dataMax, 1)]} />
          <Line
            dataKey="wpm"
            stroke="var(--primary)"
            strokeWidth={2}
            type="monotone"
            dot={({ cx, cy, payload, index }) =>
              payload.errors > 0 ? <ErrorMark key={index} cx={cx} cy={cy} size={3} /> : <g key={index} />
            }
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
