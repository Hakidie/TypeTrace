import { useState } from 'react';
import { ClipboardCheck, CloudRain, Swords, Trophy } from 'lucide-react';
import { AvatarSprite } from '@/modules/avatar/components/AvatarSprite';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { usePassageOptions } from '@/modules/typing/hooks/use-typing';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { ListRow, ListRowStat } from '@/shared/components/list-row';
import { LoadingState } from '@/shared/components/loading-state';
import { Pagination } from '@/shared/components/pagination';
import { TabGroup } from '@/shared/components/tab-group';
import { useListParams } from '@/shared/hooks/use-list-params';
import { PlacementBoard } from '../components/PlacementBoard';
import { PlacementPassageMenu } from '../components/PlacementPassageMenu';
import { useLeaderboard } from '../hooks/use-ranked';
import type { MatchKind, PlacementRange } from '../types/ranked.types';

const PAGE_SIZE = 20;

type LeaderboardTab = 'placement' | 'rank';

const RANGE_TABS = [
  { value: 'week', label: 'This week' },
  { value: 'all', label: 'All time' },
];

const KIND_TABS = [
  { value: 'race', label: 'Race', icon: Swords },
  { value: 'rain', label: 'Rain', icon: CloudRain },
];

/** The best players of the current season (5 matches or more): display names and avatars, never an email. */
export const LeaderboardPage = () => {
  const list = useListParams({ sort: '-rating' });
  // Each kind of match has its own board; the kind is in the URL (`?kind=rain`), Race without it.
  const kind: MatchKind = list.get('kind') === 'rain' ? 'rain' : 'race';
  const board = useLeaderboard({ page: list.page, limit: PAGE_SIZE, kind });
  const { data: me } = useCurrentUser();
  const [tab, setTab] = useState<LeaderboardTab>('rank');
  // Placement (US10.1): the passage and the range are in the URL (`?passage=<id>&range=all`); without a passage of the URL the board opens on a
  // random one (the dice is rolled once, when the page opens: the pick does not change while the learner stays here).
  const passages = usePassageOptions('placement', { enabled: tab === 'placement' });
  const [dice] = useState(() => Math.random());
  const passageList = passages.data;
  const passage = passageList?.find((option) => option._id === list.get('passage')) ?? passageList?.[Math.floor(dice * passageList.length)];
  const range: PlacementRange = list.get('range') === 'all' ? 'all' : 'week';
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

  const renderPlacement = () => {
    if (passages.isPending) return <LoadingState rows={5} />;
    if (passages.isError) return <ErrorState error={passages.error} onRetry={() => void passages.refetch()} />;
    if (!passage) return <EmptyState icon={ClipboardCheck} title="No placement passages" description="The board shows up once an admin publishes a placement passage." />;
    return <PlacementBoard passageId={passage._id} range={range} />;
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      {/* Same tabs as the mode tabs of the Typing page, in the center of the page; on the Placement tab the passage is on their left and the range on their right. */}
      <div className="flex flex-col items-center gap-2 md:grid md:grid-cols-[1fr_auto_1fr] md:gap-x-2">
        <div className="flex min-w-0 max-w-full md:justify-self-end">
          {tab === 'placement' && <PlacementPassageMenu passages={passageList} selectedId={passage?._id} onSelect={(id) => list.set('passage', id)} />}
        </div>
        <TabGroup label="Leaderboard" tabs={tabs} value={tab} onChange={(value) => setTab(value as LeaderboardTab)} />
        <div className="md:justify-self-start">
          {tab === 'placement' && (
            <TabGroup label="Time range" tabs={RANGE_TABS} value={range} onChange={(value) => list.set('range', value === 'all' ? 'all' : '')} />
          )}
        </div>
      </div>
      <div role="tabpanel" aria-label={tab === 'rank' ? 'Rank' : 'Placement'}>
        {tab === 'rank' ? (
          <div className="space-y-4">
            <div className="flex justify-center">
              <TabGroup
                label="Kind of match"
                tabs={KIND_TABS}
                value={kind}
                // Race is the default: no `kind` in the URL. Changing the board goes back to its first page.
                onChange={(value) => list.set('kind', value === 'rain' ? 'rain' : '')}
              />
            </div>
            {renderList()}
          </div>
        ) : (
          renderPlacement()
        )}
      </div>
    </div>
  );
};
