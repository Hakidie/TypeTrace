import { AvatarSprite } from '@/modules/avatar/components/AvatarSprite';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { Lottie } from '@/shared/components/lottie';
import { cn } from '@/shared/lib/utils';
import { useDailyBoard } from '../hooks/use-daily';
import type { DailyToday } from '../types/daily.types';
import { dailyGlass } from './DailyCard';

/**
 * Today's board beside the challenge card: one line per player (rank, avatar head, name, score), the learner's line
 * tinted, a trophy on the first one, and yesterday's winner under it. A side column, so the lines are kept to one row.
 */
export const DailyLeaderboard = ({ yesterdayWinner }: { yesterdayWinner: DailyToday['yesterdayWinner'] }) => {
  const board = useDailyBoard('today');

  return (
    <section aria-label="Today's leaderboard" className={cn('flex flex-col', dailyGlass)}>
      <div className="flex items-baseline justify-between px-4 py-3">
        <h2 className="text-lg font-semibold text-foreground">Today</h2>
        {board.data && <span className="text-sm text-muted-foreground">{board.data.players} typists</span>}
      </div>
      {board.isLoading ? (
        <LoadingState rows={4} />
      ) : board.isError ? (
        <ErrorState error={board.error} onRetry={() => board.refetch()} />
      ) : !board.data?.items.length ? (
        <EmptyState title="Be the first today" description="Your best try shows up here." />
      ) : (
        <ol>
          {board.data.items.map((row) => (
            <li
              key={row.rank}
              aria-current={row.isMe || undefined}
              className={cn('grid grid-cols-[2rem_auto_minmax(0,1fr)_auto] items-center gap-3 border-t border-foreground/10 px-4 py-2', row.isMe && 'bg-primary/15')}
            >
              <span className={cn('font-black tabular-nums', row.rank <= 3 ? 'text-primary' : 'text-muted-foreground')}>
                {row.rank === 1 ? <Lottie name="trophy" className="size-7" /> : row.rank}
              </span>
              <AvatarSprite look={row.avatar} crop="head" scale={0.8} label={`${row.displayName}'s avatar`} />
              <span className="truncate">{row.displayName}</span>
              <span className="font-semibold tabular-nums">{row.score}</span>
            </li>
          ))}
        </ol>
      )}
      {yesterdayWinner && (
        <p className="border-t border-foreground/10 px-4 py-3 text-sm text-muted-foreground">
          Yesterday's winner: {yesterdayWinner.displayName}, {yesterdayWinner.score}
        </p>
      )}
    </section>
  );
};
