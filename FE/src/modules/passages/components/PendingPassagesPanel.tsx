import { ClipboardCheck } from 'lucide-react';
import { useState } from 'react';
import { DataTable, type DataTableColumn } from '@/shared/components/data-table';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { ListToolbar } from '@/shared/components/list-toolbar';
import { Pagination } from '@/shared/components/pagination';
import { Panel } from '@/shared/components/panel';
import { Button } from '@/shared/components/ui/button';
import { useListParams } from '@/shared/hooks/use-list-params';
import { panelBodyClass, panelTitleClass } from '@/shared/lib/panel-styles';
import { usePendingPassages } from '../hooks/use-passages';
import type { Passage, ReviewDecision } from '../types/passage.types';
import { PassageViewDialog } from './PassageViewDialog';
import { ReviewDialog } from './ReviewDialog';

const PAGE_SIZE = 10;

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

/**
 * The Pending review tab of the admin passages page (SCRUM-176): learners' requests to make a passage public, oldest
 * first, with search, sort and pages kept in the URL, and new requests showing up by themselves. An admin reads a
 * passage, then approves it or turns it down with a reason, one at a time or the selected ones at once.
 */
export const PendingPassagesPanel = () => {
  const list = useListParams({ sort: 'updatedAt' });
  const passages = usePendingPassages({ page: list.page, limit: PAGE_SIZE, sort: list.sort, q: list.q || undefined });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewing, setViewing] = useState<Passage>();
  const [review, setReview] = useState<{ decision: ReviewDecision; passages: Passage[] }>();

  const rows = passages.data?.items ?? [];
  // Only rows on screen count as selected: another page or search starts with none.
  const selected = rows.filter((row) => selectedIds.includes(row._id));

  const startReview = (decision: ReviewDecision, targets: Passage[]) => {
    setViewing(undefined);
    setReview({ decision, passages: targets });
  };

  const columns: DataTableColumn<Passage>[] = [
    {
      id: 'title',
      header: 'Title',
      sortKey: 'title',
      cell: (passage) => (
        <button type="button" className="text-left font-medium hover:underline" onClick={() => setViewing(passage)}>
          {passage.title}
        </button>
      ),
    },
    { id: 'author', header: 'Author', cell: (passage) => passage.ownerName },
    { id: 'words', header: 'Words', sortKey: 'wordCount', cell: (passage) => passage.wordCount },
    { id: 'requested', header: 'Requested', sortKey: 'updatedAt', cell: (passage) => formatDate(passage.updatedAt) },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      cell: (passage) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" aria-label={`View ${passage.title}`} onClick={() => setViewing(passage)}>
            View
          </Button>
          <Button size="sm" aria-label={`Approve ${passage.title}`} onClick={() => startReview('approve', [passage])}>
            Approve
          </Button>
          <Button size="sm" variant="destructive" aria-label={`Reject ${passage.title}`} onClick={() => startReview('reject', [passage])}>
            Reject
          </Button>
        </div>
      ),
    },
  ];

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
          summary={passages.data ? `${passages.data.total} waiting` : 'Loading requests…'}
          actions={
            selected.length > 0 && (
              <>
                <Button size="sm" onClick={() => startReview('approve', selected)}>
                  Approve {selected.length}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => startReview('reject', selected)}>
                  Reject {selected.length}
                </Button>
              </>
            )
          }
        />
        {passages.isError ? (
          <ErrorState error={passages.error} onRetry={() => void passages.refetch()} />
        ) : (
          <DataTable
            label="Passages waiting for review"
            columns={columns}
            rows={rows}
            getRowId={(passage) => passage._id}
            sort={list.sort}
            onSortChange={(value) => list.set('sort', value)}
            selectedIds={selected.map((passage) => passage._id)}
            onSelectedIdsChange={setSelectedIds}
            isLoading={passages.isPending}
            emptyState={
              list.q ? (
                <EmptyState icon={ClipboardCheck} title="No matching requests" description="Try another search." />
              ) : (
                <EmptyState icon={ClipboardCheck} title="Nothing to review" description="Learners' requests to make a passage public show up here." />
              )
            }
          />
        )}
        {passages.data && (
          <Pagination page={passages.data.page} totalPages={passages.data.totalPages} onPageChange={list.setPage} variant="toolbar" />
        )}
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
