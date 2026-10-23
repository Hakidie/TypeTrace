import { ClipboardCheck } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { ListToolbar } from '@/shared/components/list-toolbar';
import { LoadingState } from '@/shared/components/loading-state';
import { Pagination } from '@/shared/components/pagination';
import { Panel } from '@/shared/components/panel';
import { Button } from '@/shared/components/ui/button';
import { useListParams } from '@/shared/hooks/use-list-params';
import { panelBodyClass, panelTitleClass } from '@/shared/lib/panel-styles';
import { usePendingPassages } from '../hooks/use-passages';
import type { Passage, ReviewDecision } from '../types/passage.types';
import { PassageCard } from './PassageCard';
import { PassageViewDialog } from './PassageViewDialog';
import { ReviewDialog } from './ReviewDialog';

// A page of the card grid, like the Passages panel above.
const PAGE_SIZE = 9;

const SORT_OPTIONS = [
  { value: 'updatedAt', label: 'Oldest request' },
  { value: '-updatedAt', label: 'Newest request' },
  { value: 'title', label: 'Title A–Z' },
  { value: 'wordCount', label: 'Shortest' },
  { value: '-wordCount', label: 'Longest' },
];

const checkboxClass = 'size-4 cursor-pointer accent-primary';

/**
 * The Pending review panel of the admin passages page, under the Passages panel (SCRUM-176): learners' requests to make
 * a passage public, as cards like the passage bank, oldest first, with search, sort and pages kept in the URL under the
 * `pending-` prefix (the bank above already uses `?page=`), and new requests showing up by themselves. An admin reads a
 * passage, then approves it or turns it down with a reason, one at a time or the ticked ones at once.
 */
export const PendingPassagesPanel = () => {
  const list = useListParams({ sort: 'updatedAt', prefix: 'pending' });
  const passages = usePendingPassages({ page: list.page, limit: PAGE_SIZE, sort: list.sort, q: list.q || undefined });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewing, setViewing] = useState<Passage>();
  const [review, setReview] = useState<{ decision: ReviewDecision; passages: Passage[] }>();

  const cards = passages.data?.items ?? [];
  // Only cards on screen count as ticked: another page or search starts with none.
  const selected = cards.filter((card) => selectedIds.includes(card._id));
  const allSelected = cards.length > 0 && selected.length === cards.length;

  const tick = (id: string, on: boolean) => setSelectedIds((ids) => (on ? [...ids, id] : ids.filter((other) => other !== id)));
  const tickAll = () => setSelectedIds(allSelected ? [] : cards.map((card) => card._id));

  const startReview = (decision: ReviewDecision, targets: Passage[]) => {
    setViewing(undefined);
    setReview({ decision, passages: targets });
  };

  const renderList = () => {
    if (passages.isPending) return <LoadingState rows={3} />;
    if (passages.isError) return <ErrorState error={passages.error} onRetry={() => void passages.refetch()} />;
    if (cards.length === 0) {
      return list.q ? (
        <EmptyState icon={ClipboardCheck} title="No matching requests" description="Try another search." />
      ) : (
        <EmptyState icon={ClipboardCheck} title="Nothing to review" description="Learners' requests to make a passage public show up here." />
      );
    }
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Passages waiting for review">
          {cards.map((passage) => (
            <PassageCard
              key={passage._id}
              passage={passage}
              review={{
                selected: selectedIds.includes(passage._id),
                onSelectedChange: (on) => tick(passage._id, on),
                onView: setViewing,
                onDecide: (target, decision) => startReview(decision, [target]),
              }}
            />
          ))}
        </div>
        <Pagination page={passages.data.page} totalPages={passages.data.totalPages} onPageChange={list.setPage} />
      </div>
    );
  };

  return (
    <Panel title="Pending review" bare titleClassName={panelTitleClass} className={panelBodyClass}>
      <div className="space-y-3">
        <ListToolbar
          search={{
            label: 'Search requests',
            placeholder: 'Search title or source…',
            defaultValue: list.q,
            onSearch: (value) => list.set('q', value),
          }}
          sort={{ value: list.sort, options: SORT_OPTIONS, onChange: (value) => list.set('sort', value) }}
          summary={passages.data ? `${passages.data.total} waiting` : 'Loading requests…'}
          actions={
            cards.length > 0 && (
              <>
                <label className="flex items-center gap-2 whitespace-nowrap text-base text-muted-foreground">
                  <input type="checkbox" checked={allSelected} onChange={tickAll} className={checkboxClass} />
                  Select all
                </label>
                {selected.length > 0 && (
                  <>
                    <Button size="sm" onClick={() => startReview('approve', selected)}>
                      Approve {selected.length}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => startReview('reject', selected)}>
                      Reject {selected.length}
                    </Button>
                  </>
                )}
              </>
            )
          }
        />
        {renderList()}
      </div>

      <PassageViewDialog passage={viewing} onClose={() => setViewing(undefined)} onReview={(passage, decision) => startReview(decision, [passage])} />
      {review && (
        <ReviewDialog
          key={`${review.decision}:${review.passages.map((passage) => passage._id).join()}`}
          decision={review.decision}
          passages={review.passages}
          onClose={() => setReview(undefined)}
          onDone={() => setSelectedIds([])}
        />
      )}
    </Panel>
  );
};
