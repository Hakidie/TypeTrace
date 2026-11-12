import { Trophy } from 'lucide-react';
import { useState } from 'react';
import { AvatarSprite } from '@/modules/avatar/components/AvatarSprite';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { cn } from '@/shared/lib/utils';
import type { BoardRange } from '../api/word-chain.api';
import { useWordChainBoard } from '../hooks/use-word-chain';
import { TEXT, type WordChainText } from '../lib/word-chain-text';

/**
 * The Nối từ leaderboard (in the game's modal and on the Minigames tab of the Leaderboard page): this week (from Monday 0:00 in Vietnam) or all the time, one line per player
 * (rank, avatar head, name, best score), the player's line tinted, and their own place under the list when they are further down.
 */
export const WordChainBoard = ({ text = TEXT.en, className }: { text?: WordChainText; className?: string }) => {
  const [range, setRange] = useState<BoardRange>('week');
  const ranges: { id: BoardRange; label: string }[] = [
    { id: 'week', label: text.thisWeek },
    { id: 'all', label: text.allTime },
  ];
  const board = useWordChainBoard(range);
  const meShown = board.data?.items.some((row) => row.isMe);

  return (
    <section aria-label={text.boardLabel} className={cn('flex flex-col border border-primary/20 bg-background/30 backdrop-blur-sm', className)}>
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Trophy className="size-4 text-primary" aria-hidden="true" /> {text.leaderboard}
        </h2>
        <div role="tablist" aria-label={text.timeRange} className="flex border border-primary/20">
          {ranges.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={range === id}
              onClick={() => setRange(id)}
              className={cn(
                'cursor-pointer px-2.5 py-1 text-xs transition-colors',
                range === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {board.isLoading ? (
        <LoadingState rows={4} />
      ) : board.isError ? (
        <ErrorState error={board.error} onRetry={() => board.refetch()} />
      ) : !board.data?.items.length ? (
        <EmptyState title={text.noOne} description={text.noOneHint} />
      ) : (
        <ol className="max-h-[26rem] overflow-y-auto">
          {board.data.items.map((row) => (
            <li
              key={row.rank}
              aria-current={row.isMe || undefined}
              className={cn(
                'grid grid-cols-[1.75rem_auto_minmax(0,1fr)_auto] items-center gap-3 border-t border-foreground/10 px-4 py-2',
                row.isMe && 'bg-primary/15',
              )}
            >
              <span className={cn('font-black tabular-nums', row.rank <= 3 ? 'text-primary' : 'text-muted-foreground')}>{row.rank}</span>
              <AvatarSprite look={row.avatar} crop="head" scale={0.8} label={`${row.displayName}'s avatar`} />
              <span className="truncate">{row.displayName}</span>
              <span className="font-semibold tabular-nums">{row.score}</span>
            </li>
          ))}
        </ol>
      )}
      {board.data?.me && !meShown && (
        <p className="border-t border-foreground/10 px-4 py-3 text-sm text-muted-foreground">
          {text.yourPlace(board.data.me.rank, board.data.me.score)}
        </p>
      )}
    </section>
  );
};
