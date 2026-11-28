import { useTranslation } from 'react-i18next';
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
  // Stacked on a phone held upright: three equal right-aligned columns under the name; from `sm` one line at the right of the name.
  <div className="grid grid-cols-3 gap-2 sm:flex sm:justify-end sm:gap-8">
    <ListRowStat compactOnPhones label="WPM" value={String(wpm)} className="sm:w-24" />
    <ListRowStat compactOnPhones label="ACC" value={`${accuracy}%`} className="sm:w-24" />
    <ListRowStat compactOnPhones label="TIME" value={formatBoardTime(durationMs)} className="sm:w-24" />
  </div>
);

/** The top 50 of one placement passage (US10.1), and the place of the learner when they are not among them. Names and avatars only. */
export const PlacementBoard = ({ passageId, range }: { passageId: string; range: PlacementRange }) => {
  const { t } = useTranslation('ranked');
  const board = usePlacementBoard({ passageId, range });
  const minAccuracy = usePlacementMinAccuracy();

  if (board.isPending) return <LoadingState rows={5} />;
  if (board.isError) return <ErrorState error={board.error} onRetry={() => void board.refetch()} />;
  if (board.data.items.length === 0) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title={t('board.noResultsTitle')}
        description={t('board.noResultsHint', { min: minAccuracy })}
      />
    );
  }

  const { items, me } = board.data;
  return (
    <div className="space-y-2">
      {items.map((row) => (
        <ListRow
          plain
          extraBeside
          key={row.rank}
          identity={
            <div className="flex min-w-0 items-center gap-3">
              <span className="w-16 shrink-0 text-3xl font-black xl:w-12 xl:text-2xl">#{row.rank}</span>
              <AvatarSprite look={row.avatar} crop="head" scale={1} label={t('avatarOf', { name: row.displayName })} />
              <p className="min-w-0 truncate text-lg font-semibold">
                {row.displayName}
                {row.isMe && <span className="ml-2 text-sm text-muted-foreground">{t('you')}</span>}
              </p>
            </div>
          }
          center={<SessionLine timeline={row.timeline} />}
          extra={<Stats wpm={row.wpm} accuracy={row.accuracy} durationMs={row.durationMs} />}
        />
      ))}
      {me && !items.some((row) => row.isMe) && (
        <section aria-label={t('board.yourPlace')} className="pt-4">
          <ListRow
            plain
            extraBeside
            identity={
              <div className="flex min-w-0 items-center gap-3">
                <span className="w-16 shrink-0 text-3xl font-black xl:w-12 xl:text-2xl">#{me.rank}</span>
                <p className="text-lg font-semibold">{t('board.you')}</p>
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
