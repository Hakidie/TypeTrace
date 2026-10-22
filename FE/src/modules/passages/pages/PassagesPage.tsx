import { FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
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
import { useDeleteOwnPassage, useLearnerPassages, useRequestPublic, useWithdrawRequest } from '../hooks/use-learner-passages';
import { ANONYMOUS_OWNER_NAME } from '../passages.config';
import type { LearnerPassage, PassageVisibility } from '../types/passage.types';

const PAGE_SIZE = 9;

const SORT_OPTIONS = [
  { value: '-createdAt', label: 'Newest' },
  { value: 'title', label: 'Title A–Z' },
  { value: '-title', label: 'Title Z–A' },
  { value: 'wordCount', label: 'Shortest' },
  { value: '-wordCount', label: 'Longest' },
];

// Private = the learner's own private passages; public = TypeTrace's and the learners' passages an admin approved.
const VISIBILITY_OPTIONS = [
  { value: 'private', label: 'Private' },
  { value: 'public', label: 'Public' },
];

/**
 * The learner's Passages page (SCRUM-34): a form to paste a text of their own, and every passage they can practice
 * (the public ones and their own) with search, sort, a visibility filter and pages. Practice opens a passage on the
 * Typing page. An own private passage can be offered to everyone: an admin reviews the request (SCRUM-176).
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
  // The author everyone sees once a passage is approved: the display name, else ANONYMOUS_OWNER_NAME (never the email).
  const displayName = useCurrentUser().data?.displayName?.trim();
  const deletePassage = useDeleteOwnPassage();
  const requestPublic = useRequestPublic();
  const withdrawRequest = useWithdrawRequest();
  // The passages waiting for a confirmation: to delete, and to send for review.
  const [deleting, setDeleting] = useState<LearnerPassage>();
  const [requesting, setRequesting] = useState<LearnerPassage>();

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
          {passages.data.items.map((passage) => {
            // Only private passages are the learner's to change; once public, only an admin can.
            const ownPrivate = passage.isOwn && passage.visibility === 'private';
            return (
              <LearnerPassageCard
                key={passage._id}
                passage={passage}
                onDelete={ownPrivate ? setDeleting : undefined}
                onRequestPublic={ownPrivate && passage.status === 'published' ? setRequesting : undefined}
                onWithdraw={ownPrivate && passage.status === 'pending' ? (target) => withdrawRequest.mutate(target._id) : undefined}
              />
            );
          })}
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
            filters={[
              { label: 'Visibility', value: visibility, options: VISIBILITY_OPTIONS, onChange: (value) => list.set('visibility', value) },
            ]}
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

      <ConfirmDialog
        open={requesting !== undefined}
        onOpenChange={(open) => !open && setRequesting(undefined)}
        title="Make this passage public?"
        description={
          requesting
            ? `An admin will review "${requesting.title}". Once approved, every learner can practice it and only an admin can remove it. ${
                displayName
                  ? `It will show your display name, "${displayName}".`
                  : `It will show "${ANONYMOUS_OWNER_NAME}": set a display name in your profile to show yours.`
              }`
            : undefined
        }
        confirmLabel="Send request"
        pending={requestPublic.isPending}
        onConfirm={() => requesting && requestPublic.mutate(requesting._id, { onSuccess: () => setRequesting(undefined) })}
      />
    </div>
  );
};
