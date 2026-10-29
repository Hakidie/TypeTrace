import { useState } from 'react';
import { ClipboardCheck, Trophy } from 'lucide-react';
import { AvatarSprite } from '@/modules/avatar/components/AvatarSprite';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { ListRow, ListRowStat } from '@/shared/components/list-row';
import { LoadingState } from '@/shared/components/loading-state';
import { Pagination } from '@/shared/components/pagination';
import { TabGroup } from '@/shared/components/tab-group';
import { useListParams } from '@/shared/hooks/use-list-params';
import { useLeaderboard } from '../hooks/use-ranked';

const PAGE_SIZE = 20;

type LeaderboardTab = 'placement' | 'rank';

/** The best players of the current season (5 matches or more): display names and avatars, never an email. */
export const LeaderboardPage = () => {
  const list = useListParams({ sort: '-rating' });
  const board = useLeaderboard({ page: list.page, limit: PAGE_SIZE });
  const { data: me } = useCurrentUser();
  const [tab, setTab] = useState<LeaderboardTab>('rank');
  // The Rank tab names the season: "Rank S1".
  const tabs = [
    { value: 'placement', label: 'Placement', icon: ClipboardCheck },
    { value: 'rank', label: board.data ? `Rank S${board.data.season.number}` : 'Rank', icon: Trophy },
  ];

  const renderList = () => {
    if (board.isPending) return <LoadingState rows={5} />;
    if (board.isError) return <ErrorState error={board.error} onRetry={() => void board.refetch()} />;
    if (board.data.items.length === 0) {
      return <EmptyState icon={Trophy} title="No ranked players yet" description="Players show up here after 5 rated matches this season." />;
    }
    return (
      <div className="space-y-2">
        {board.data.items.map((row) => (
          <ListRow
            key={row.userId}
            identity={
              <div className="flex min-w-0 items-center gap-3">
                <span className="w-12 shrink-0 text-2xl font-black">#{row.rank}</span>
                <AvatarSprite look={row.avatar} crop="head" scale={1} label={`${row.displayName}'s avatar`} />
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold">
                    {row.displayName}
                    {row.userId === me?._id && <span className="ml-2 text-sm text-muted-foreground">(you)</span>}
                  </p>
                  <p className="text-sm text-muted-foreground">{row.tier}</p>
                </div>
              </div>
            }
            extra={
              <div className="flex justify-end gap-6">
                <ListRowStat label="Matches" value={String(row.matches)} className="w-20" />
                <ListRowStat label="Win rate" value={`${Math.round(row.winRate * 100)}%`} className="w-24" />
                <ListRowStat label="Rating" value={String(row.rating)} className="w-24" />
              </div>
            }
          />
        ))}
        <Pagination page={board.data.page} totalPages={board.data.totalPages} onPageChange={list.setPage} variant="toolbar" />
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      {/* Same tabs as the mode tabs of the Typing page, in the center of the page. */}
      <div className="flex justify-center">
        <TabGroup label="Leaderboard" tabs={tabs} value={tab} onChange={(value) => setTab(value as LeaderboardTab)} />
      </div>
      <div role="tabpanel" aria-label={tab === 'rank' ? 'Rank' : 'Placement'}>
        {tab === 'rank' ? (
          renderList()
        ) : (
          <EmptyState icon={Trophy} title="No placement results yet" description="Placement test scores will show up here." />
        )}
      </div>
    </div>
  );
};
