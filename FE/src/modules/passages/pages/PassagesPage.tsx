import { FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { usePlan } from '@/modules/plan/hooks/use-plan';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { CompactToolbar } from '@/shared/components/compact-toolbar';
import { LoadingState } from '@/shared/components/loading-state';
import { Pagination } from '@/shared/components/pagination';
import { Panel } from '@/shared/components/panel';
import { PanelTitleSwitch } from '@/shared/components/panel-title-switch';
import { useListParams } from '@/shared/hooks/use-list-params';
import { sectionTitleClass } from '@/shared/lib/panel-styles';
import { OwnPassageForm } from '../components/OwnPassageForm';
import { PassageCard } from '../components/PassageCard';
import { RejectionReasonDialog } from '../components/RejectionReasonDialog';
import {
  useDeleteOwnPassage,
  useLearnerPassages,
  useOwnPassage,
  useRequestPublic,
  useWithdrawRequest,
} from '../hooks/use-learner-passages';
import { ANONYMOUS_OWNER_NAME } from '../passages.config';
import type { LearnerPassage, PassageVisibility } from '../types/passage.types';

// Three columns of three, like the passage bank of the admin area.
const PAGE_SIZE = 9;

export const PassagesPage = () => {
  const { t } = useTranslation('passages');
  const sortOptions = [
    { value: '-createdAt', label: t('sort.newest') },
    { value: 'title', label: t('sort.titleAZ') },
    { value: '-title', label: t('sort.titleZA') },
    { value: 'wordCount', label: t('sort.shortest') },
    { value: '-wordCount', label: t('sort.longest') },
  ];
  const visibilityOptions = [
    { value: 'private', label: t('visibility.private') },
    { value: 'public', label: t('visibility.public') },
  ];
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
  // How many passages of their own the learner has and how many their plan allows (US11.1).
  const plan = usePlan();
  // The author everyone sees once a passage is approved: the display name, else ANONYMOUS_OWNER_NAME (never the email).
  const displayName = useCurrentUser().data?.displayName?.trim();
  const deletePassage = useDeleteOwnPassage();
  const requestPublic = useRequestPublic();
  const withdrawRequest = useWithdrawRequest();
  // The passages waiting for a confirmation: to delete, and to send for review.
  const [deleting, setDeleting] = useState<LearnerPassage>();
  const [requesting, setRequesting] = useState<LearnerPassage>();
  // The turned-down passage whose reason is open.
  const [reasonOf, setReasonOf] = useState<LearnerPassage>();
  // The passage open in the top panel (Edit passage instead of New passage), loaded with its text.
  const [editingId, setEditingId] = useState<string>();
  const editing = useOwnPassage(editingId);
  // The form and My Passages share the page: one at a time, switched by the button of each panel (the form first).
  const [view, setView] = useState<'form' | 'list'>('form');

  // A card that asks to be edited shows the form, loaded with its passage.
  const startEditing = (passage: LearnerPassage) => {
    setEditingId(passage._id);
    setView('form');
  };
  // A passage that is deleted or sent for review can no longer be edited: the panel goes back to New passage.
  const stopEditing = (id: string) => setEditingId((current) => (current === id ? undefined : current));

  const renderForm = () => {
    if (!editingId) return <OwnPassageForm key="new" ownCount={plan.data?.usedPassages} maxCount={plan.data?.maxPassages} />;
    if (editing.isPending) return <LoadingState rows={2} />;
    if (editing.isError) return <ErrorState error={editing.error} onRetry={() => void editing.refetch()} />;
    // `key` remounts the form, so it starts from the passage being edited.
    return (
      <OwnPassageForm
        key={editingId}
        passage={editing.data}
        onDone={() => {
          // Saved or cancelled: back to the list.
          setEditingId(undefined);
          setView('list');
        }}
      />
    );
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
        <EmptyState icon={FileText} title={t('list.noMatch')} description={t('list.noMatchHint')} />
      ) : (
        <EmptyState icon={FileText} title={t('list.none')} description={t('list.noneHint')} />
      );
    }
    // Like the passage bank of the admin area: a grid of cards, the pages at the bottom right.
    return (
      <>
        {/* -mx-4: the 16px padding of the cards goes outside, so their text lines up with the title and the toolbar above and the pages below */}
        <div className="-mx-4 grid gap-4 sm:grid-cols-2 lg:min-h-0 lg:flex-1 lg:grid-cols-3 lg:grid-rows-[repeat(3,minmax(0,1fr))]" aria-label={t('list.cards')}>
          {passages.data.items.map((passage) => {
            // A private passage is the learner's to change and delete; while it waits for review it can only be taken back
            // or deleted. A public one can be edited (an admin approves the edit, the approved text stays public
            // meanwhile) and its edit taken back, but only an admin deletes it.
            const ownPrivate = passage.isOwn && passage.visibility === 'private';
            const ownPublic = passage.isOwn && passage.visibility === 'public';
            const waiting = passage.status === 'pending';
            // Past the limit of the plan: nothing but deleting, public or not (it is the way to get a place back).
            const locked = passage.locked === true;
            // Archived by an admin: nothing to do with it, not even deleting.
            const archived = passage.status === 'archived';
            return (
              <PassageCard
                key={passage._id}
                passage={passage}
                own={{
                  onEdit: !locked && !archived && ((ownPrivate && !waiting) || ownPublic) ? startEditing : undefined,
                  onDelete: !archived && (ownPrivate || locked) ? setDeleting : undefined,
                  onRequestPublic: !locked && !archived && ownPrivate && !waiting ? setRequesting : undefined,
                  onWithdraw: !locked && !archived && ((ownPrivate && waiting) || (ownPublic && passage.editPending)) ? (target) => withdrawRequest.mutate(target._id) : undefined,
                  onShowReason: setReasonOf,
                }}
              />
            );
          })}
        </div>
      </>
    );
  };

  // The pages, at the bottom right, above the row of the switch button (nothing while the list is loading, empty or failed).
  const pagination =
    passages.data && passages.data.items.length > 0 ? (
      <Pagination page={passages.data.page} totalPages={passages.data.totalPages} onPageChange={list.setPage} variant="toolbar" accent plain flushRight />
    ) : undefined;

  return (
    // On a desktop the page is one screen tall below the header (the footer is below it, like the Typing page): the panel
    // shown takes all of it, and the cards show as many lines of text as fit.
    <div className="flex flex-1 flex-col gap-12">
      {view === 'form' ? (
        <div className="lg:flex lg:min-h-[28rem] lg:flex-1 lg:flex-col">
          {/* No visible title (the form says what it is); screen readers still get one. The switch is under the form. */}
          {/* PANEL Passage form */}
          <Panel bare fill>
            <h2 className="sr-only">{editingId ? t('view.editPassage') : t('view.newPassage')}</h2>
            {renderForm()}
          </Panel>
          {/* Apart from the panel, 12px under it; the panel takes the height the screen leaves. */}
          <div className="mt-3 flex shrink-0 items-center justify-center">
            <PanelTitleSwitch other={t('view.myPassages')} showLabel onClick={() => setView('list')} />
          </div>
        </div>
      ) : (
        <div className="lg:flex lg:min-h-[28rem] lg:flex-1 lg:flex-col">
          {/* PANEL My passages */}
          <Panel
            title={t('view.myPassages')}
            bare
            fill
            actionsBesideTitle
            titleClassName={sectionTitleClass}
            className="flex min-h-0 flex-1 flex-col gap-3"
            actions={
              <CompactToolbar
                search={{
                  label: t('search.label'),
                  placeholder: t('search.placeholder'),
                  defaultValue: list.q,
                  onSearch: (value) => list.set('q', value),
                }}
                sort={{ value: list.sort, options: sortOptions, onChange: (value) => list.set('sort', value) }}
                filters={[
                  { label: t('visibility.label'), value: visibility, options: visibilityOptions, onChange: (value) => list.set('visibility', value) },
                ]}
                count={{ icon: FileText, value: passages.data?.total ?? '…', label: t('search.count') }}
              />
            }
          >
            {renderList()}
            {pagination}
          </Panel>
          {/* Apart from the panel, 12px under it (`mt-3`). */}
          <div className="mt-3 flex shrink-0 items-center justify-center">
            <PanelTitleSwitch other={editingId ? t('view.editPassage') : t('view.newPassage')} showLabel onClick={() => setView('form')} />
          </div>
        </div>
      )}

      <RejectionReasonDialog passage={reasonOf} onClose={() => setReasonOf(undefined)} />

      <ConfirmDialog
        open={deleting !== undefined}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        title={t('delete.title')}
        description={deleting ? t('delete.description', { title: deleting.title }) : undefined}
        confirmLabel={t('delete.confirm')}
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
        title={t('request.title')}
        description={
          requesting
            ? t('request.description', {
                title: requesting.title,
                owner: displayName ? t('request.ownerNamed', { name: displayName }) : t('request.ownerAnonymous', { name: ANONYMOUS_OWNER_NAME }),
              })
            : undefined
        }
        confirmLabel={t('request.confirm')}
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
