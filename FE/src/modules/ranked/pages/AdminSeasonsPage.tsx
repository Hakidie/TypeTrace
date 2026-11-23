import { CalendarRange, CloudRain, Lock, Swords } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { Pagination } from '@/shared/components/pagination';
import { Panel } from '@/shared/components/panel';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { useListParams } from '@/shared/hooks/use-list-params';
import { useCloseSeason, useSeasons } from '../hooks/use-ranked';
import { LeaderboardLink } from '../components/LeaderboardLink';
import { SeasonPanel } from '../components/SeasonPanel';
import type { MatchKind, Season } from '../types/ranked.types';

const PAGE_SIZE = 20;

// The names of the kinds of match are the `kinds.*` of the `ranked` namespace.
const ICONS: Record<MatchKind, ReactNode> = {
  race: <Swords className="size-6" aria-hidden="true" />,
  rain: <CloudRain className="size-6" aria-hidden="true" />,
};

/**
 * The ranked seasons. One is always active and ends by itself after 8 weeks; the admin can close it early, which opens
 * the next season at once.
 */
export const AdminSeasonsPage = () => {
  const { t } = useTranslation('ranked');
  const kindName = (value: MatchKind) => t(`kinds.${value}`);
  const list = useListParams({ sort: '-number' });
  const seasons = useSeasons({ page: list.page, limit: PAGE_SIZE });
  const close = useCloseSeason();
  const [closing, setClosing] = useState<Season>();
  const [kind, setKind] = useState<MatchKind>('race');

  const renderList = () => {
    if (seasons.isPending) return <LoadingState rows={3} />;
    if (seasons.isError) return <ErrorState error={seasons.error} onRetry={() => void seasons.refetch()} />;
    if (seasons.data.items.length === 0) return <EmptyState icon={CalendarRange} title={t('adminSeasons.none')} />;
    return (
      <div className="space-y-2">
        {seasons.data.items.map((season) => (
          <SeasonPanel
            key={season._id}
            number={season.number}
            startsAt={season.startsAt}
            endsAt={season.closedAt ?? season.endsAt}
            // One mode at a time, the same for every season: a click shows the other one.
            headline={
              <button
                type="button"
                aria-label={t('adminSeasons.mode', { mode: kindName(kind) })}
                onClick={() => setKind(kind === 'race' ? 'rain' : 'race')}
                className="flex items-center gap-2 transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {ICONS[kind]}
                <span>{kindName(kind)}</span>
              </button>
            }
            subline={t('adminSeasons.players', { count: season.participants[kind] })}
            value={season.status === 'active' ? t('adminSeasons.ongoing') : t('adminSeasons.closed')}
            valueLabel={t('adminSeasons.status')}
            actions={<LeaderboardLink />}
            trailing={
              season.status === 'active' && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label={t('adminSeasons.close')}
                        onClick={() => setClosing(season)}
                        // Hidden it takes no room (no width, and a negative margin for the gap of the panel); it grows in while the
                        // panel is hovered or holds the focus (always there on touch screens, which cannot hover).
                        className={cn(
                          'flex size-[2.3rem] shrink-0 items-center justify-center overflow-hidden text-primary transition-[width,margin,opacity] duration-200 hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          '-ml-6 w-0 opacity-0 group-hover:ml-0 group-hover:w-[2.3rem] group-hover:opacity-100 group-focus-within:ml-0 group-focus-within:w-[2.3rem] group-focus-within:opacity-100 pointer-coarse:ml-0 pointer-coarse:w-[2.3rem] pointer-coarse:opacity-100',
                        )}
                      >
                        <Lock className="size-6" aria-hidden="true" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t('adminSeasons.close')}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )
            }
          />
        ))}
        <Pagination page={seasons.data.page} totalPages={seasons.data.totalPages} onPageChange={list.setPage} variant="toolbar" />
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* PANEL Seasons: one Season panel (`SeasonPanel`) for each season, no title, border or padding. */}
      <Panel bare>{renderList()}</Panel>
      <ConfirmDialog
        open={closing !== undefined}
        onOpenChange={(open) => !open && setClosing(undefined)}
        title={t('adminSeasons.closeTitle', { number: closing?.number ?? '' })}
        description={t('adminSeasons.closeDescription')}
        confirmLabel={t('adminSeasons.close')}
        destructive
        pending={close.isPending}
        onConfirm={() => close.mutate(closing!._id, { onSuccess: () => setClosing(undefined) })}
      />
    </div>
  );
};
