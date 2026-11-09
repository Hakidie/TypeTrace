import { FileText } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { CompactToolbar } from '@/shared/components/compact-toolbar';
import { LoadingState } from '@/shared/components/loading-state';
import { Pagination } from '@/shared/components/pagination';
import { Panel } from '@/shared/components/panel';
import { sectionTitleClass } from '@/shared/lib/panel-styles';
import { useListParams } from '@/shared/hooks/use-list-params';
import { ListViewSwitch } from '../components/ListViewSwitch';
import { PassageCard } from '../components/PassageCard';
import { PassageForm } from '../components/PassageForm';
import { PendingPassagesPanel } from '../components/PendingPassagesPanel';
import { useDeletePassage, usePassages } from '../hooks/use-passages';
import type { Passage, PassageLanguage, PassageStatus } from '../types/passage.types';

// Two rows of three cards.
const PAGE_SIZE = 6;

// The first option is the default one.
const SORT_OPTIONS = [
  { value: '-createdAt', label: 'Newest' },
  { value: 'createdAt', label: 'Oldest' },
  { value: '-updatedAt', label: 'Recently updated' },
  { value: 'title', label: 'Title A–Z' },
  { value: '-title', label: 'Title Z–A' },
  { value: 'wordCount', label: 'Shortest' },
  { value: '-wordCount', label: 'Longest' },
];

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

// `?language=vi|en` in the URL: English passages are only used in ranked duels.
const LANGUAGE_OPTIONS = [
  { value: 'vi', label: 'Vietnamese' },
  { value: 'en', label: 'English' },
];

// `?type=placement|regular` in the URL, sent as `isPlacement=true|false`.
const TYPE_OPTIONS = [
  { value: 'placement', label: 'Placement' },
  { value: 'regular', label: 'Regular' },
];

/** The second panel is the passage bank or the review queue, switched by the button before its search (`?view=pending`). */
type View = 'passages' | 'pending';

/**
 * The passage bank: a "New passage" panel (the form, also used to edit) and a "Passages" panel with the card grid of the
 * public passages, TypeTrace's and the approved ones. Learners' private passages are not part of it: an admin only sees
 * one when its learner asks for it to become public (the Pending review panel). Search, filters, sort and page stay in
 * the URL (`?q=&status=&type=&sort=&page=`, SCRUM-159); the Pending review panel below uses the `pending-` names.
 */
const PassageBank = ({ view, onSwitchView }: { view: View; onSwitchView: () => void }) => {
  const list = useListParams({ sort: '-createdAt' });
  const status = list.get('status') as PassageStatus | '';
  const type = list.get('type');
  const language = list.get('language') as PassageLanguage | '';
  const [editing, setEditing] = useState<Passage | null>(null);
  const [deleting, setDeleting] = useState<Passage | null>(null);
  const deletePassage = useDeletePassage();
  const formPanelRef = useRef<HTMLDivElement>(null);
  const passages = usePassages({
    page: list.page,
    limit: PAGE_SIZE,
    sort: list.sort,
    q: list.q || undefined,
    status: status || undefined,
    isPlacement: type ? type === 'placement' : undefined,
    language: language || undefined,
    visibility: 'public',
  });

  // A page past the end (its last passage was just deleted, or an old link) goes back to the last page. Not while the
  // previous list is still on screen (`keepPreviousData`): its page count belongs to other filters.
  const { page, setPage } = list;
  const lastPage = passages.isPlaceholderData ? 0 : (passages.data?.totalPages ?? 0);
  useEffect(() => {
    if (lastPage > 0 && page > lastPage) setPage(lastPage);
  }, [lastPage, page, setPage]);

  const isFiltered = Boolean(list.q || status || type);

  // The form is at the top of the page: bring it into view when a card asks to be edited.
  const startEditing = (passage: Passage) => {
    setEditing(passage);
    formPanelRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  const renderList = () => {
    if (passages.isPending) return <LoadingState rows={3} />;
    if (passages.isError) return <ErrorState error={passages.error} onRetry={() => void passages.refetch()} />;
    // Past the end: the effect above is moving back to the last page.
    if (passages.data.totalPages > 0 && passages.data.page > passages.data.totalPages) return <LoadingState rows={3} />;
    if (passages.data.items.length === 0) {
      return isFiltered ? (
        <EmptyState icon={FileText} title="No matching passages" description="Try another search or filter." />
      ) : (
        <EmptyState icon={FileText} title="No passages yet" description="Add the first passage with the form above." />
      );
    }
    return (
      <div className="space-y-3">
        {/* -mx-4: the 16px padding of the cards goes outside, so their text lines up with the title and the toolbar above and the pages below */}
        <div className="-mx-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {passages.data.items.map((passage) => (
            <PassageCard
              key={passage._id}
              passage={passage}
              onEdit={startEditing}
              onDelete={setDeleting}
            />
          ))}
        </div>
        <Pagination page={passages.data.page} totalPages={passages.data.totalPages} onPageChange={list.setPage} variant="toolbar" accent plain flushRight />
      </div>
    );
  };

  return (
    <>
      {/* `flex-1`: the form takes the height the list below leaves on the screen, its text area grows with it. */}
      <div ref={formPanelRef} className="flex scroll-mt-4 flex-col lg:flex-1">
        {/* PANEL Passage form: no visible title (the form says what it is); screen readers still get one. */}
        <Panel bare fill>
          <h2 className="sr-only">{editing ? 'Edit passage' : 'New passage'}</h2>
          {/* `key` remounts the form, so it starts from the passage being edited (or empty). */}
          <PassageForm
            key={editing?._id ?? 'new'}
            passage={editing ?? undefined}
            onDone={() => setEditing(null)}
            onDelete={setDeleting}
          />
        </Panel>
      </div>
      {view === 'pending' ? (
        <PendingPassagesPanel onSwitchView={onSwitchView} />
      ) : (
        // PANEL Passages
        <Panel
          title={<ListViewSwitch current="Passage list" other="Pending review" onSwitch={onSwitchView} />}
          bare
          titleClassName={sectionTitleClass}
          className="space-y-3"
          actions={
            <CompactToolbar
            showWords
              search={{
                label: 'Search passages',
                placeholder: 'Search title or source…',
                defaultValue: list.q,
                onSearch: (value) => list.set('q', value),
              }}
              sort={{ value: list.sort, options: SORT_OPTIONS, onChange: (value) => list.set('sort', value) }}
              filters={[
                { label: 'Status', value: status, options: STATUS_OPTIONS, onChange: (value) => list.set('status', value) },
                { label: 'Type', value: type, options: TYPE_OPTIONS, onChange: (value) => list.set('type', value) },
                { label: 'Language', value: language, options: LANGUAGE_OPTIONS, onChange: (value) => list.set('language', value) },
              ]}
              count={{ icon: FileText, value: passages.data?.total ?? '…', label: 'Passages' }}
            />
          }
        >
          {renderList()}
        </Panel>
      )}
      {/* One confirmation for both ways to delete for good: the card's Delete icon and Delete passage in the edit form. */}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this passage for good?"
        description={deleting ? `"${deleting.title}" is removed for good. A passage learners have typed cannot be deleted.` : undefined}
        confirmLabel="Delete"
        destructive
        pending={deletePassage.isPending}
        onConfirm={() =>
          deleting &&
          deletePassage.mutate(deleting._id, {
            onSuccess: () => {
              if (editing?._id === deleting._id) setEditing(null);
            },
            // Refused too (learners typed it): the toast says why, and asking again would not change the answer.
            onSettled: () => setDeleting(null),
          })
        }
      />
    </>
  );
};

/**
 * Admin passages page: the New passage panel, then one list panel that is either the passage bank or the Pending review
 * queue (learners' requests to make a passage public, SCRUM-176); the title button of its toolbar switches between them.
 */
export const AdminPassagesPage = () => {
  const [params, setParams] = useSearchParams();
  const view: View = params.get('view') === 'pending' ? 'pending' : 'passages';
  const switchView = () =>
    setParams((next) => {
      if (view === 'pending') next.delete('view');
      else next.set('view', 'pending');
      return next;
    });

  return (
    <div className="flex flex-1 flex-col gap-8">
      <PassageBank view={view} onSwitchView={switchView} />
    </div>
  );
};
