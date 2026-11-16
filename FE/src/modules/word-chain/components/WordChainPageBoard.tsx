import { useTranslation } from 'react-i18next';
import { Gamepad2 } from 'lucide-react';
import { AvatarSprite } from '@/modules/avatar/components/AvatarSprite';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { ListRow, ListRowStat } from '@/shared/components/list-row';
import { LoadingState } from '@/shared/components/loading-state';
import type { BoardRange } from '../api/word-chain.api';
import { useWordChainBoard } from '../hooks/use-word-chain';

const Score = ({ score }: { score: number }) => (
  <div className="flex w-full justify-end xl:w-auto">
    <ListRowStat label="SCORE" value={String(score)} className="w-24" />
  </div>
);

/**
 * The Nối từ board on the Minigames tab of the Leaderboard page, in the look of the Placement board: plain rows
 * (rank, avatar head, name, score) and the player's own place under the list when they are further down.
 * The range (this week / all time) is picked by the page.
 */
export const WordChainPageBoard = ({ range }: { range: BoardRange }) => {
  const { t } = useTranslation('ranked');
  const board = useWordChainBoard(range);

  if (board.isPending) return <LoadingState rows={5} />;
  if (board.isError) return <ErrorState error={board.error} onRetry={() => void board.refetch()} />;
  if (board.data.items.length === 0) {
    return <EmptyState icon={Gamepad2} title={t('leaderboard.chainEmptyTitle')} description={t('leaderboard.chainEmptyHint')} />;
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
              <AvatarSprite look={row.avatar} crop="head" scale={1} label={t('avatarOf', { name: row.displayName })} />
              <p className="min-w-0 truncate text-lg font-semibold">
                {row.displayName}
                {row.isMe && <span className="ml-2 text-sm text-muted-foreground">{t('you')}</span>}
              </p>
            </div>
          }
          extra={<Score score={row.score} />}
        />
      ))}
      {me && !items.some((row) => row.isMe) && (
        <section aria-label={t('board.yourPlace')} className="pt-4">
          <ListRow
            plain
            identity={
              <div className="flex min-w-0 items-center gap-3">
                <span className="w-12 shrink-0 text-2xl font-black">#{me.rank}</span>
                <p className="text-lg font-semibold">{t('board.you')}</p>
              </div>
            }
            extra={<Score score={me.score} />}
          />
        </section>
      )}
    </div>
  );
};
