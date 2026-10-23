import { FileText } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
import { PassageRow } from '../components/PassageRow';
import { OwnPassageForm } from '../components/OwnPassageForm';
import {
  useDeleteOwnPassage,
  useLearnerPassages,
  useOwnPassage,
  useRequestPublic,
  useWithdrawRequest,
} from '../hooks/use-learner-passages';
import { ANONYMOUS_OWNER_NAME } from '../passages.config';
import type { LearnerPassage, PassageVisibility } from '../types/passage.types';

// As many as a page of the admin users list.
const PAGE_SIZE = 10;

const SORT_OPTIONS = [
  { value: '-createdAt', label: 'Newest' },
  { value: 'title', label: 'Title A–Z' },
  { value: '-title', label: 'Title Z–A' },
  { value: 'wordCount', label: 'Shortest' },
  { value: '-wordCount', label: 'Longest' },
];

// Among the learner's own passages: private = not public (yet), also while it waits for review; public = approved by an admin.
const VISIBILITY_OPTIONS = [
  { value: 'private', label: 'Private' },
  { value: 'public', label: 'Public' },
];

/**
 * The learner's Passages page (SCRUM-34): a form to paste a text of their own, and all of their own passages (private,
 * waiting for review or approved; nobody else's) with search, sort, a visibility filter and pages. Practice opens a
 * passage on the Typing page, whose passage menu also offers TypeTrace's passages. An own private passage can be offered
 * to everyone: an admin reviews the request (SCRUM-176).
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
    mine: true,
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
  // The passage open in the top panel (Edit passage instead of New passage), loaded with its text.
  const [editingId, setEditingId] = useState<string>();
  const editing = useOwnPassage(editingId);
  const formPanelRef = useRef<HTMLDivElement>(null);

  // The form is at the top of the page: bring it into view when a card asks to be edited.
  const startEditing = (passage: LearnerPassage) => {
    setEditingId(passage._id);
    formPanelRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };
  // A passage that is deleted or sent for review can no longer be edited: the panel goes back to New passage.
  const stopEditing = (id: string) => setEditingId((current) => (current === id ? undefined : current));

  const renderForm = () => {
    if (!editingId) return <OwnPassageForm key="new" ownCount={own.data?.total} />;
    if (editing.isPending) return <LoadingState rows={2} />;
    if (editing.isError) return <ErrorState error={editing.error} onRetry={() => void editing.refetch()} />;
    // `key` remounts the form, so it starts from the passage being edited.
    return <OwnPassageForm key={editingId} passage={editing.data} onDone={() => setEditingId(undefined)} />;
  };

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
    // Like the users list of the admin area: one row per passage, the pages at the bottom right.
    return (
      <>
        <div className="space-y-2" aria-label="Passage rows">
          {passages.data.items.map((passage) => {
            // Only private passages are the learner's to change; once public, only an admin can. While one waits for
            // review it can only be taken back or deleted.
            const ownPrivate = passage.isOwn && passage.visibility === 'private';
            const waiting = passage.status === 'pending';
            return (
              <PassageRow
                key={passage._id}
                passage={passage}
                onEdit={ownPrivate && !waiting ? startEditing : undefined}
                onDelete={ownPrivate ? setDeleting : undefined}
                onRequestPublic={ownPrivate && !waiting ? setRequesting : undefined}
                onWithdraw={ownPrivate && waiting ? (target) => withdrawRequest.mutate(target._id) : undefined}
              />
            );
          })}
        </div>
        <Pagination page={passages.data.page} totalPages={passages.data.totalPages} onPageChange={list.setPage} variant="toolbar" />
      </>
    );
  };

  return (
    <div className="space-y-8">
      <div ref={formPanelRef} className="scroll-mt-4">
        <Panel title={editingId ? 'Edit passage' : 'New passage'} bare titleClassName={panelTitleClass} className={panelBodyClass}>
          {renderForm()}
        </Panel>
      </div>

      <Panel title="My passages" bare titleClassName={panelTitleClass} className={panelBodyClass}>
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
        onConfirm={() =>
          deleting &&
          deletePassage.mutate(deleting._id, {
            onSuccess: () => {
              stopEditing(deleting._id);
              setDeleting(undefined);
            },
          })
        }
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
        onConfirm={() =>
          requesting &&
          requestPublic.mutate(requesting._id, {
            onSuccess: () => {
              stopEditing(requesting._id);
              setRequesting(undefined);
            },
          })
        }
      />
    </div>
  );
};
