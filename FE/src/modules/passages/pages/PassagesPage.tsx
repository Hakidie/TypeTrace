import { FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { ListToolbar } from '@/shared/components/list-toolbar';
import { LoadingState } from '@/shared/components/loading-state';
import { Pagination } from '@/shared/components/pagination';
import { Panel } from '@/shared/components/panel';
import { useListParams } from '@/shared/hooks/use-list-params';
import { panelBodyClass, panelTitleClass } from '@/shared/lib/panel-styles';
import { LearnerPassageCard } from '../components/LearnerPassageCard';
import { OwnPassageForm } from '../components/OwnPassageForm';
import { useDeleteOwnPassage, useLearnerPassages } from '../hooks/use-learner-passages';
import type { LearnerPassage, PassageVisibility } from '../types/passage.types';

const PAGE_SIZE = 9;

const SORT_OPTIONS = [
  { value: '-createdAt', label: 'Newest' },
  { value: 'title', label: 'Title A–Z' },
  { value: '-title', label: 'Title Z–A' },
  { value: 'wordCount', label: 'Shortest' },
  { value: '-wordCount', label: 'Longest' },
];

const OWNER_OPTIONS = [
  { value: 'private', label: 'Mine' },
  { value: 'public', label: 'TypeTrace' },
];

/**
 * The learner's Passages page (SCRUM-34): a form to paste a text of their own, and every passage they can practice
 * (TypeTrace's and their own) with search, sort, an owner filter and pages. Practice opens a passage on the Typing page.
 */
export const PassagesPage = () => {
  const list = useListParams({ sort: '-createdAt' });
  const visibility = list.get('visibility') as PassageVisibility | '';
  const passages = useLearnerPassages({
    page: list.page,
    limit: PAGE_SIZE,
    sort: list.sort,
    q: list.q || undefined,
    visibility: visibility || undefined,
  });
  // Only its total is used: how many passages of their own the learner has.
  const own = useLearnerPassages({ visibility: 'private', limit: 1 });
  const deletePassage = useDeleteOwnPassage();
  // The passage waiting for delete confirmation.
  const [deleting, setDeleting] = useState<LearnerPassage>();

  // A page past the end (its last passage was just deleted, or an old link) goes back to the last page. Not while the
  // previous list is still on screen (`keepPreviousData`): its page count belongs to other filters.
  const { page, setPage } = list;
  const lastPage = passages.isPlaceholderData ? 0 : (passages.data?.totalPages ?? 0);
  useEffect(() => {
    if (lastPage > 0 && page > lastPage) setPage(lastPage);
  }, [lastPage, page, setPage]);

  const renderList = () => {
    if (passages.isPending) return <LoadingState rows={3} />;
    if (passages.isError) return <ErrorState error={passages.error} onRetry={() => void passages.refetch()} />;
    if (passages.data.items.length === 0) {
      // Past the last page: the effect above is going back to it.
      if (passages.data.totalPages > 0 && passages.data.page > passages.data.totalPages) return <LoadingState rows={3} />;
      return list.q || visibility ? (
        <EmptyState icon={FileText} title="No matching passages" description="Try another search or filter." />
      ) : (
        <EmptyState icon={FileText} title="No passages yet" description="Paste a text in the form above to add one." />
      );
    }
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {passages.data.items.map((passage) => (
            <LearnerPassageCard
              key={passage._id}
              passage={passage}
              onDelete={passage.visibility === 'private' ? setDeleting : undefined}
            />
          ))}
        </div>
        <Pagination page={passages.data.page} totalPages={passages.data.totalPages} onPageChange={list.setPage} />
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <Panel title="New passage" bare titleClassName={panelTitleClass} className={panelBodyClass}>
        <OwnPassageForm ownCount={own.data?.total} />
      </Panel>

      <Panel title="Passages" bare titleClassName={panelTitleClass} className={panelBodyClass}>
        <div className="space-y-3">
          <ListToolbar
            search={{
              label: 'Search passages',
              placeholder: 'Search titles…',
              defaultValue: list.q,
              onSearch: (value) => list.set('q', value),
            }}
            sort={{ value: list.sort, options: SORT_OPTIONS, onChange: (value) => list.set('sort', value) }}
            summary={passages.data ? `${passages.data.total} passages` : 'Loading passages…'}
            filters={[{ label: 'Owner', value: visibility, options: OWNER_OPTIONS, onChange: (value) => list.set('visibility', value) }]}
          />
          {renderList()}
        </div>
      </Panel>

      <ConfirmDialog
        open={deleting !== undefined}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        title="Delete this passage?"
        description={deleting ? `"${deleting.title}" will be removed from your passages. Your typing results stay.` : undefined}
        confirmLabel="Delete"
        destructive
        pending={deletePassage.isPending}
        onConfirm={() => deleting && deletePassage.mutate(deleting._id, { onSuccess: () => setDeleting(undefined) })}
      />
    </div>
  );
};
