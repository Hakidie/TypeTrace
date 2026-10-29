import { CalendarRange } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { ListRow } from '@/shared/components/list-row';
import { LoadingState } from '@/shared/components/loading-state';
import { Pagination } from '@/shared/components/pagination';
import { Panel } from '@/shared/components/panel';
import { Button } from '@/shared/components/ui/button';
import { useListParams } from '@/shared/hooks/use-list-params';
import { panelBodyClass, panelTitleClass } from '@/shared/lib/panel-styles';
import { useCloseSeason, useSeasons } from '../hooks/use-ranked';
import type { Season } from '../types/ranked.types';

const PAGE_SIZE = 20;

const day = (iso: string) => new Date(iso).toLocaleDateString();

/**
 * The ranked seasons. One is always active and ends by itself after 8 weeks; the admin can close it early, which opens
 * the next season at once.
 */
export const AdminSeasonsPage = () => {
  const list = useListParams({ sort: '-number' });
  const seasons = useSeasons({ page: list.page, limit: PAGE_SIZE });
  const close = useCloseSeason();
  const [closing, setClosing] = useState<Season>();

  const renderList = () => {
    if (seasons.isPending) return <LoadingState rows={3} />;
    if (seasons.isError) return <ErrorState error={seasons.error} onRetry={() => void seasons.refetch()} />;
    if (seasons.data.items.length === 0) return <EmptyState icon={CalendarRange} title="No seasons yet" />;
    return (
      <div className="space-y-2">
        {seasons.data.items.map((season) => (
          <ListRow
            key={season._id}
            identity={
              <div className="min-w-0">
                <p className="text-lg font-semibold">Season {season.number}</p>
                <p className="text-sm text-muted-foreground">
                  {day(season.startsAt)} – {day(season.closedAt ?? season.endsAt)}
                </p>
              </div>
            }
            extra={<p className="text-right font-semibold">{season.status === 'active' ? 'Active' : 'Closed'}</p>}
            action={
              season.status === 'active' && (
                <Button size="sm" variant="outline" onClick={() => setClosing(season)}>
                  Close season
                </Button>
              )
            }
          />
        ))}
        <Pagination page={seasons.data.page} totalPages={seasons.data.totalPages} onPageChange={list.setPage} variant="toolbar" />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Panel title="Seasons" bare titleClassName={panelTitleClass} className={panelBodyClass}>
        {renderList()}
      </Panel>
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
