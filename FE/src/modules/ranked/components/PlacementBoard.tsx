import { ClipboardCheck } from 'lucide-react';
import { AvatarSprite } from '@/modules/avatar/components/AvatarSprite';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { ListRow, ListRowStat } from '@/shared/components/list-row';
import { LoadingState } from '@/shared/components/loading-state';
import { SessionLine } from '@/modules/profile/components/SessionLine';
import { usePlacementBoard, usePlacementMinAccuracy } from '../hooks/use-ranked';
import { formatBoardTime } from '../lib/placement-board';
import type { PlacementRange } from '../types/ranked.types';

interface StatsProps {
  wpm: number;
  accuracy: number;
  durationMs: number;
}

const Stats = ({ wpm, accuracy, durationMs }: StatsProps) => (
  <div className="flex w-full justify-between gap-4 xl:w-auto xl:justify-end xl:gap-8">
    <ListRowStat label="WPM" value={String(wpm)} className="w-24" />
    <ListRowStat label="ACC" value={`${accuracy}%`} className="w-24" />
    <ListRowStat label="TIME" value={formatBoardTime(durationMs)} className="w-24" />
  </div>
);

/** The top 50 of one placement passage (US10.1), and the place of the learner when they are not among them. Names and avatars only. */
export const PlacementBoard = ({ passageId, range }: { passageId: string; range: PlacementRange }) => {
  const board = usePlacementBoard({ passageId, range });
  const minAccuracy = usePlacementMinAccuracy();

  if (board.isPending) return <LoadingState rows={5} />;
  if (board.isError) return <ErrorState error={board.error} onRetry={() => void board.refetch()} />;
  if (board.data.items.length === 0) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="No placement results yet"
        description={`Finish this passage in a 3-minute placement session with ${minAccuracy}% accuracy or more to be on the board.`}
      />
    );
  }

  const { items, me } = board.data;
  return (
    <div className="space-y-2">
      {items.map((row) => (
        <ListRow
          plain
          key={row.rank}
          identity={
            <div className="flex min-w-0 items-center gap-3">
              <span className="w-12 shrink-0 text-2xl font-black">#{row.rank}</span>
              <AvatarSprite look={row.avatar} crop="head" scale={1} label={`${row.displayName}'s avatar`} />
              <p className="min-w-0 truncate text-lg font-semibold">
                {row.displayName}
                {row.isMe && <span className="ml-2 text-sm text-muted-foreground">(you)</span>}
              </p>
            </div>
          }
          center={<SessionLine timeline={row.timeline} />}
          extra={<Stats wpm={row.wpm} accuracy={row.accuracy} durationMs={row.durationMs} />}
        />
      ))}
      {me && !items.some((row) => row.isMe) && (
        <section aria-label="Your place" className="pt-4">
          <ListRow
            plain
            identity={
              <div className="flex min-w-0 items-center gap-3">
                <span className="w-12 shrink-0 text-2xl font-black">#{me.rank}</span>
                <p className="text-lg font-semibold">You</p>
              </div>
            }
            center={<SessionLine timeline={me.timeline} />}
            extra={<Stats wpm={me.wpm} accuracy={me.accuracy} durationMs={me.durationMs} />}
          />
        </section>
      )}
    </div>
  );
};
