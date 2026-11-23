import { ClipboardCheck } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { CompactToolbar } from '@/shared/components/compact-toolbar';
import { LoadingState } from '@/shared/components/loading-state';
import { Pagination } from '@/shared/components/pagination';
import { Panel } from '@/shared/components/panel';
import { PanelTitleSwitch } from '@/shared/components/panel-title-switch';
import { useListParams } from '@/shared/hooks/use-list-params';
import { sectionTitleClass } from '@/shared/lib/panel-styles';
import { usePendingPassages } from '../hooks/use-passages';
import type { Passage, ReviewDecision } from '../types/passage.types';
import { PassageCard } from './PassageCard';
import { PassageViewDialog } from './PassageViewDialog';
import { ReviewDialog } from './ReviewDialog';

// A page of the card grid, like the Passages panel above.
const PAGE_SIZE = 9;

/**
 * The Pending review panel of the admin passages page, under the Passages panel (SCRUM-176): learners' requests to make
 * a passage public, as cards like the passage bank, oldest first, with search, sort and pages kept in the URL under the
 * `pending-` prefix (the bank above already uses `?page=`), and new requests showing up by themselves. An admin reads a
 * passage, then approves it or turns it down with a reason, one at a time or the ticked ones at once.
 */
export const PendingPassagesPanel = ({ onSwitchView }: { onSwitchView: () => void }) => {
  const { t } = useTranslation('passages');
  const sortOptions = [
    { value: 'updatedAt', label: t('admin.sort.oldestRequest') },
    { value: '-updatedAt', label: t('admin.sort.newestRequest') },
    { value: 'title', label: t('sort.titleAZ') },
    { value: 'wordCount', label: t('sort.shortest') },
    { value: '-wordCount', label: t('sort.longest') },
  ];
  // What waits in the queue: a learner's edit of a public passage (the Edited tag), or a request to make a passage public.
  const kindOptions = [
    { value: 'edited', label: t('admin.pending.kinds.edited') },
    { value: 'pending', label: t('admin.pending.kinds.pending') },
  ];
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
        <EmptyState icon={ClipboardCheck} title={t('admin.pending.noMatch')} description={t('admin.pending.noMatchHint')} />
      ) : (
        <EmptyState icon={ClipboardCheck} title={t('admin.pending.none')} description={t('admin.pending.noneHint')} />
      );
    }
    return (
      <div className="space-y-3">
        {/* -mx-4: the 16px padding of the cards goes outside, so their text lines up with the title and the toolbar above and the pages below */}
        <div className="-mx-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label={t('admin.pending.cards')}>
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
        <Pagination page={passages.data.page} totalPages={passages.data.totalPages} onPageChange={list.setPage} variant="toolbar" accent plain flushRight />
      </div>
    );
  };

  return (
    // PANEL Pending review
    <Panel
      title={t('admin.pending.title')}
      titleAction={<PanelTitleSwitch other={t('admin.bank.title')} onClick={onSwitchView} />}
      bare
      titleClassName={sectionTitleClass}
      className="space-y-3"
      actions={
        <CompactToolbar
            showWords
          // The decision on the chosen cards: filled buttons before the other parts.
          decisions={
            selected.length > 0
              ? [
                  { label: t('admin.pending.approveSelected', { count: selected.length }), onClick: () => startReview('approve', selected) },
                  { label: t('admin.pending.rejectSelected', { count: selected.length }), onClick: () => startReview('reject', selected), destructive: true },
                ]
              : []
          }
          search={{
            label: t('admin.pending.searchLabel'),
            placeholder: t('admin.pending.searchPlaceholder'),
            defaultValue: list.q,
            onSearch: (value) => list.set('q', value),
          }}
          sort={{ value: list.sort, options: sortOptions, onChange: (value) => list.set('sort', value) }}
          filters={[{ label: t('admin.filters.type'), value: kind, options: kindOptions, onChange: (value) => list.set('kind', value) }]}
          count={{ icon: ClipboardCheck, value: passages.data?.total ?? '…', label: t('admin.pending.count') }}
        />
      }
    >
      {renderList()}

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
