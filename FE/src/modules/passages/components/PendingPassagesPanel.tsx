import { ClipboardCheck } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { ListToolbar } from '@/shared/components/list-toolbar';
import { LoadingState } from '@/shared/components/loading-state';
import { Pagination } from '@/shared/components/pagination';
import { Panel } from '@/shared/components/panel';
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

// What waits in the queue: a learner's edit of a public passage (the Edited tag), or a request to make a passage public.
const KIND_OPTIONS = [
  { value: 'edited', label: 'Edited' },
  { value: 'pending', label: 'Pending' },
];

/**
 * The Pending review panel of the admin passages page, under the Passages panel (SCRUM-176): learners' requests to make
 * a passage public, as cards like the passage bank, oldest first, with search, sort and pages kept in the URL under the
 * `pending-` prefix (the bank above already uses `?page=`), and new requests showing up by themselves. An admin reads a
 * passage, then approves it or turns it down with a reason, one at a time or the ticked ones at once.
 */
export const PendingPassagesPanel = () => {
  const list = useListParams({ sort: 'updatedAt', prefix: 'pending' });
  const kind = list.get('kind');
  const passages = usePendingPassages({
    page: list.page,
    limit: PAGE_SIZE,
    sort: list.sort,
    q: list.q || undefined,
    edited: kind ? kind === 'edited' : undefined,
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewing, setViewing] = useState<Passage>();
  const [review, setReview] = useState<{ decision: ReviewDecision; passages: Passage[] }>();

  const cards = passages.data?.items ?? [];
  // Only cards on screen count as chosen: another page or search starts with none.
  const selected = cards.filter((card) => selectedIds.includes(card._id));

  const choose = (id: string, on: boolean) => setSelectedIds((ids) => (on ? [...ids, id] : ids.filter((other) => other !== id)));

  const startReview = (decision: ReviewDecision, targets: Passage[]) => {
    setViewing(undefined);
    setReview({ decision, passages: targets });
  };

  const renderList = () => {
    if (passages.isPending) return <LoadingState rows={3} />;
    if (passages.isError) return <ErrorState error={passages.error} onRetry={() => void passages.refetch()} />;
    if (cards.length === 0) {
      return list.q || kind ? (
        <EmptyState icon={ClipboardCheck} title="No matching requests" description="Try another search or filter." />
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
                onSelectedChange: (on) => choose(passage._id, on),
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
          filters={[{ label: 'Type', value: kind, options: KIND_OPTIONS, onChange: (value) => list.set('kind', value) }]}
          summary={passages.data ? `${passages.data.total} waiting` : 'Loading requests…'}
          // The decision on the chosen cards: parts of the toolbar of their own, like Sort and Filter.
          decisions={
            selected.length > 0
              ? [
                  { label: `Approve ${selected.length}`, onClick: () => startReview('approve', selected) },
                  { label: `Reject ${selected.length}`, onClick: () => startReview('reject', selected), destructive: true },
                ]
              : []
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
