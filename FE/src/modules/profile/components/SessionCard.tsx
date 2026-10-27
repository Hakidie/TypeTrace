import { Link } from 'react-router-dom';
import { ListRow, ListRowStat } from '@/shared/components/list-row';
import { formatTimeLimit, modeIcons } from '@/modules/typing/typing.config';
import type { SessionSummary } from '../types/profile.types';
import { SessionLine } from './SessionLine';

/**
 * One finished typing session, built like the user card of the admin area (`ListRow`): the icon of the mode and the passage name on
 * the left, the speed line (where the heatmap is) in the middle, WPM, ACC and TIME (the time chosen) on the right; the date under the passage name, with no bottom tier. The whole card links to the result page of the session.
 */
export const SessionCard = ({ session }: { session: SessionSummary }) => {
  const ModeIcon = modeIcons[session.mode];
  const title = session.passageTitle ?? 'Untitled passage';
  const date = new Date(session.completedAt ?? session.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return (
    <Link
      to={`/typing/result/${session._id}`}
      aria-label={`Open the result of ${title}`}
      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ListRow
        plain
        identity={
          <div className="flex min-w-0 items-center gap-3">
            {/* The icon of the mode, 61px = the height of the speed line, no background. */}
            <span className="flex size-[61px] shrink-0 items-center justify-center text-primary" aria-hidden>
              <ModeIcon className="size-9" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-2xl font-extrabold text-primary/80">{title}</p>
              <p className="truncate text-lg text-muted-foreground">{date}</p>
            </div>
          </div>
        }
        center={<SessionLine timeline={session.timeline} />}
        extra={
          // The columns have one width each (the widest value fits) and the same gap between them, so they line up from row to row.
          <div className="flex w-full justify-between gap-4 xl:w-auto xl:justify-end xl:gap-8">
            <ListRowStat className="w-16" label="WPM" value={String(Math.round(session.wpm ?? 0))} />
            <ListRowStat className="w-28" label="ACC" value={`${(session.accuracy ?? 0).toFixed(1)}%`} />
            <ListRowStat className="w-16" label="TIME" value={session.timeLimitSeconds ? formatTimeLimit(session.timeLimitSeconds) : '—'} />
          </div>
        }
      />
    </Link>
  );
};
