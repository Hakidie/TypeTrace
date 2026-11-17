import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { ClipboardCheck, CloudRain, Gamepad2, Swords, Trophy } from 'lucide-react';
import { AvatarSprite } from '@/modules/avatar/components/AvatarSprite';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { WordChainPageBoard } from '@/modules/word-chain/components/WordChainPageBoard';
import { usePassageOptions } from '@/modules/typing/hooks/use-typing';
import { languageNames } from '@/modules/typing/typing.config';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { ListRow, ListRowStat } from '@/shared/components/list-row';
import { LoadingState } from '@/shared/components/loading-state';
import { Pagination } from '@/shared/components/pagination';
import { TabGroup } from '@/shared/components/tab-group';
import { useListParams } from '@/shared/hooks/use-list-params';
import { type TypingLanguage, typingLanguages } from '@/shared/lib/typing-language';
import { PlacementBoard } from '../components/PlacementBoard';
import { PlacementPassageMenu } from '../components/PlacementPassageMenu';
import { useLeaderboard } from '../hooks/use-ranked';
import type { MatchKind, PlacementRange } from '../types/ranked.types';

const PAGE_SIZE = 20;

type LeaderboardTab = 'placement' | 'rank' | 'minigames';

export const LeaderboardPage = () => {
  const { t } = useTranslation('ranked');
  const rangeTabs = [
    { value: 'week', label: t('leaderboard.ranges.week') },
    { value: 'all', label: t('leaderboard.ranges.all') },
  ];
  const kindTabs = [
    { value: 'race', label: t('kinds.race'), icon: Swords },
    { value: 'rain', label: t('kinds.rain'), icon: CloudRain },
  ];
  const list = useListParams({ sort: '-rating' });
  // Each kind of match has its own board; the kind is in the URL (`?kind=rain`), Race without it.
  const kind: MatchKind = list.get('kind') === 'rain' ? 'rain' : 'race';
  const board = useLeaderboard({ page: list.page, limit: PAGE_SIZE, kind });
  const { data: me } = useCurrentUser();
  // `?tab=minigames` opens the Minigames tab (the link of the Nối từ leaderboard modal); Rank otherwise.
  const [tab, setTab] = useState<LeaderboardTab>(() => (list.get('tab') === 'minigames' ? 'minigames' : 'rank'));
  // Placement has one test per typing language (SCRUM-305) and each passage its own board, so a board is of one language: the
  // language is in the URL (`?language=en`), the signed-in learner's own typing language without it, Vietnamese for a guest.
  const urlLanguage = list.get('language');
  const placementLanguage: TypingLanguage = urlLanguage === 'vi' || urlLanguage === 'en' ? urlLanguage : (me?.settings?.typingLanguage ?? 'vi');
  const languageTabs = typingLanguages.map((value) => ({ value, label: languageNames[value] }));
  // Placement (US10.1): the passage and the range are in the URL (`?passage=<id>&range=all`); without a passage of the URL (or
  // with one of the other language) the board opens on a random one of the language (the dice is rolled once, when the page
  // opens: the pick does not change while the learner stays here).
  const passages = usePassageOptions('placement', { enabled: tab === 'placement', language: placementLanguage });
  const [dice] = useState(() => Math.random());
  const passageList = passages.data;
  const passage = passageList?.find((option) => option._id === list.get('passage')) ?? passageList?.[Math.floor(dice * passageList.length)];
  const range: PlacementRange = list.get('range') === 'all' ? 'all' : 'week';
  // The Rank tab names the season: "Rank S1".
  const tabs = [
    { value: 'placement', label: t('leaderboard.tabs.placement'), icon: ClipboardCheck },
    { value: 'rank', label: board.data ? t('leaderboard.tabs.rankSeason', { number: board.data.season.number }) : t('leaderboard.tabs.rank'), icon: Trophy },
    { value: 'minigames', label: t('leaderboard.tabs.minigames'), icon: Gamepad2 },
  ];

  const renderList = () => {
    if (board.isPending) return <LoadingState rows={5} />;
    if (board.isError) return <ErrorState error={board.error} onRetry={() => void board.refetch()} />;
    if (board.data.items.length === 0) {
      return <EmptyState icon={Trophy} title={t('leaderboard.emptyTitle')} description={t('leaderboard.emptyHint')} />;
    }
    return (
      <div className="space-y-2">
        {board.data.items.map((row) => (
          <ListRow
            key={row.userId}
            identity={
              <div className="flex min-w-0 items-center gap-3">
                <span className="w-12 shrink-0 text-2xl font-black">#{row.rank}</span>
                <AvatarSprite look={row.avatar} crop="head" scale={1} label={t('avatarOf', { name: row.displayName })} />
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold">
                    {row.displayName}
                    {row.userId === me?._id && <span className="ml-2 text-sm text-muted-foreground">{t('you')}</span>}
                  </p>
                  <p className="text-sm text-muted-foreground">{row.tier}</p>
                </div>
              </div>
            }
            extra={
              <div className="flex justify-end gap-6">
                <ListRowStat label={t('leaderboard.matches')} value={String(row.matches)} className="w-20" />
                <ListRowStat label={t('leaderboard.winRate')} value={`${Math.round(row.winRate * 100)}%`} className="w-24" />
                <ListRowStat label={t('leaderboard.rating')} value={String(row.rating)} className="w-24" />
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
    if (!passage) {
      const language = languageNames[placementLanguage];
      return <EmptyState icon={ClipboardCheck} title={t('leaderboard.noPlacementTitle', { language })} description={t('leaderboard.noPlacementHint', { language })} />;
    }
    return <PlacementBoard passageId={passage._id} range={range} />;
  };

  return (
    <div className="w-full space-y-6">
      {/* Same tabs as the mode tabs of the Typing page, in the center of the page; on the Placement tab the passage is on their left and the range on their right. */}
      <div className="relative flex flex-col items-center gap-2 md:grid md:grid-cols-[1fr_auto_1fr] md:gap-x-2">
        <div className="flex min-w-0 max-w-full md:justify-self-end">
          {tab === 'placement' && <PlacementPassageMenu passages={passageList} selectedId={passage?._id} onSelect={(id) => list.set('passage', id)} />}
          {/* ponytail: a fixed label while Nối từ is the only minigame with a board; make it a game menu like the passage one when another gets its own. */}
          {tab === 'minigames' && (
            <div className="flex min-w-0 max-w-full outline outline-1 -outline-offset-1 outline-border">
              <span aria-label={t('leaderboard.minigame')} className="block max-w-64 min-w-0 truncate px-3 py-1.5 text-[1.125rem] text-primary">
                {t('leaderboard.wordChain')}
              </span>
            </div>
          )}
        </div>
        <TabGroup label={t('leaderboard.aria')} tabs={tabs} value={tab} onChange={(value) => setTab(value as LeaderboardTab)} />
        <div className="md:justify-self-start">
          {(tab === 'placement' || tab === 'minigames') && (
            <TabGroup label={t('leaderboard.timeRange')} tabs={rangeTabs} value={range} onChange={(value) => list.set('range', value === 'all' ? 'all' : '')} />
          )}
        </div>
      </div>
      <div role="tabpanel" aria-label={tab === 'rank' ? t('leaderboard.tabs.rank') : tab === 'minigames' ? t('leaderboard.tabs.minigames') : t('leaderboard.tabs.placement')}>
        {tab === 'minigames' ? (
          // ponytail: Nối từ is the only minigame with a board; add a game picker here when another one gets its own.
          <WordChainPageBoard range={range} />
        ) : tab === 'rank' ? (
          <div className="space-y-4">
            <div className="flex justify-center">
              <TabGroup
                label={t('leaderboard.kindOfMatch')}
                tabs={kindTabs}
                value={kind}
                // Race is the default: no `kind` in the URL. Changing the board goes back to its first page.
                onChange={(value) => list.set('kind', value === 'rain' ? 'rain' : '')}
              />
            </div>
            {renderList()}
          </div>
        ) : (
          <div className="space-y-4">
            {/* One board per language, like the kinds of match of Rank (SCRUM-305): the passage menu above follows it. */}
            <div className="flex justify-center">
              <TabGroup label={t('leaderboard.placementLanguage')} tabs={languageTabs} value={placementLanguage} onChange={(value) => list.set('language', value)} />
            </div>
            {renderPlacement()}
          </div>
        )}
      </div>
    </div>
  );
};
