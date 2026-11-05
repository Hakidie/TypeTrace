import { CalendarRange, CloudRain, Lock, Swords } from 'lucide-react';
import { useState, type ReactNode } from 'react';
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

const MODES: Record<MatchKind, { label: string; icon: ReactNode }> = {
  race: { label: 'Race', icon: <Swords className="size-6" aria-hidden="true" /> },
  rain: { label: 'Rain', icon: <CloudRain className="size-6" aria-hidden="true" /> },
};

/**
 * The ranked seasons. One is always active and ends by itself after 8 weeks; the admin can close it early, which opens
 * the next season at once.
 */
export const AdminSeasonsPage = () => {
  const list = useListParams({ sort: '-number' });
  const seasons = useSeasons({ page: list.page, limit: PAGE_SIZE });
  const close = useCloseSeason();
  const [closing, setClosing] = useState<Season>();
  const [kind, setKind] = useState<MatchKind>('race');

  const renderList = () => {
    if (seasons.isPending) return <LoadingState rows={3} />;
    if (seasons.isError) return <ErrorState error={seasons.error} onRetry={() => void seasons.refetch()} />;
    if (seasons.data.items.length === 0) return <EmptyState icon={CalendarRange} title="No seasons yet" />;
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
                aria-label={`Mode: ${MODES[kind].label}`}
                onClick={() => setKind(kind === 'race' ? 'rain' : 'race')}
                className="flex items-center gap-2 transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {MODES[kind].icon}
                <span>{MODES[kind].label}</span>
              </button>
            }
            subline={`${season.participants[kind]} ${season.participants[kind] === 1 ? 'player' : 'players'}`}
            value={season.status === 'active' ? 'ON GOING' : 'CLOSED'}
            valueLabel="Status"
            actions={<LeaderboardLink />}
            trailing={
              season.status === 'active' && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label="Close season"
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
                    <TooltipContent>Close season</TooltipContent>
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
        title={`Close season ${closing?.number ?? ''}?`}
        description="The next season opens at once. Every player starts it halfway back to 1000."
        confirmLabel="Close season"
        destructive
        pending={close.isPending}
        onConfirm={() => close.mutate(closing!._id, { onSuccess: () => setClosing(undefined) })}
      />
    </div>
  );
};
