import { FileText } from 'lucide-react';
import { useRef, useState } from 'react';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { Pagination } from '@/shared/components/pagination';
import { Panel } from '@/shared/components/panel';
import { usePagination } from '@/shared/hooks/use-pagination';
import { panelBodyClass, panelTitleClass } from '@/shared/lib/panel-styles';
import { PassageCard } from '../components/PassageCard';
import { PassageForm } from '../components/PassageForm';
import { PendingPassagesPanel } from '../components/PendingPassagesPanel';
import { useDeletePassage, usePassages } from '../hooks/use-passages';
import type { Passage } from '../types/passage.types';

const PAGE_SIZE = 9;

/**
 * The passage bank: a "New passage" panel (the form, also used to edit) and a "Passages" panel with the card grid of the
 * public passages, TypeTrace's and the approved ones. Learners' private passages are not part of it: an admin only sees
 * one when its learner asks for it to become public (the Pending review panel).
 */
const PassageBank = () => {
  const { page, setPage } = usePagination();
  const [editing, setEditing] = useState<Passage | null>(null);
  const [deleting, setDeleting] = useState<Passage | null>(null);
  const deletePassage = useDeletePassage();
  const formPanelRef = useRef<HTMLDivElement>(null);
  const passages = usePassages({ page, limit: PAGE_SIZE, sort: '-createdAt', visibility: 'public' });

  // The form is at the top of the page: bring it into view when a card asks to be edited.
  const startEditing = (passage: Passage) => {
    setEditing(passage);
    formPanelRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  const renderList = () => {
    if (passages.isPending) return <LoadingState rows={3} />;
    if (passages.isError) return <ErrorState error={passages.error} onRetry={() => void passages.refetch()} />;
    if (passages.data.items.length === 0) {
      return <EmptyState icon={FileText} title="No passages yet" description="Add the first passage with the form above." />;
    }
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {passages.data.items.map((passage) => (
            <PassageCard
              key={passage._id}
              passage={passage}
              onEdit={startEditing}
              onDelete={setDeleting}
            />
          ))}
        </div>
        <Pagination page={passages.data.page} totalPages={passages.data.totalPages} onPageChange={setPage} />
      </div>
    );
  };

  return (
    <>
      <div ref={formPanelRef} className="scroll-mt-4">
        <Panel title={editing ? 'Edit passage' : 'New passage'} bare titleClassName={panelTitleClass} className={panelBodyClass}>
          {/* `key` remounts the form, so it starts from the passage being edited (or empty). */}
          <PassageForm key={editing?._id ?? 'new'} passage={editing ?? undefined} onDone={() => setEditing(null)} />
        </Panel>
      </div>
      <Panel title="Passages" bare titleClassName={panelTitleClass} className={panelBodyClass}>
        <div className="space-y-6">
          {renderList()}
        </div>
      </Panel>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this passage for good?"
        description={deleting ? `"${deleting.title}" is removed for good. A passage with typing sessions cannot be deleted.` : undefined}
        confirmLabel="Delete"
        destructive
        pending={deletePassage.isPending}
        onConfirm={() =>
          deleting &&
          deletePassage.mutate(deleting._id, {
            onSuccess: () => {
              if (editing?._id === deleting._id) setEditing(null);
              setDeleting(null);
            },
          })
        }
      />
    </>
  );
};

/**
 * Admin passages page: the passage bank (New passage and Passages panels), then the Pending review panel below it with
 * the learners' requests to make a passage public (SCRUM-176).
 */
export const AdminPassagesPage = () => (
  <div className="space-y-8">
    <PassageBank />
    <PendingPassagesPanel />
  </div>
);
