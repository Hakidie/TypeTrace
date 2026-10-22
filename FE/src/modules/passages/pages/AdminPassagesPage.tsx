import { useQueryClient } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { type ReactNode, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { Pagination } from '@/shared/components/pagination';
import { Panel } from '@/shared/components/panel';
import { usePagination } from '@/shared/hooks/use-pagination';
import { panelBodyClass, panelTitleClass } from '@/shared/lib/panel-styles';
import { cn } from '@/shared/lib/utils';
import { PassageCard } from '../components/PassageCard';
import { PassageForm } from '../components/PassageForm';
import { PendingPassagesPanel } from '../components/PendingPassagesPanel';
import { passageKeys, usePassages, usePendingPassages } from '../hooks/use-passages';
import type { Passage } from '../types/passage.types';

const PAGE_SIZE = 9;

/** The passage bank: a "New passage" panel (the form, also used to edit) and a "Passages" panel with the card grid. */
const PassageBank = () => {
  const { page, setPage } = usePagination();
  const [editing, setEditing] = useState<Passage | null>(null);
  const formPanelRef = useRef<HTMLDivElement>(null);
  const passages = usePassages({ page, limit: PAGE_SIZE, sort: '-createdAt' });

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
    </>
  );
};

const Tab = ({ selected, onSelect, children }: { selected: boolean; onSelect: () => void; children: ReactNode }) => (
  <button
    type="button"
    role="tab"
    aria-selected={selected}
    onClick={onSelect}
    className={cn(
      'flex items-center gap-2 px-4 py-2 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      selected ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
    )}
  >
    {children}
  </button>
);

/**
 * Admin passages page, two tabs: the passage bank, and Pending review (SCRUM-176), the learners' requests to make a
 * passage public, with how many wait on the tab. `?tab=pending` opens the second one.
 */
export const AdminPassagesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const tab = searchParams.get('tab') === 'pending' ? 'pending' : 'bank';
  // Only its total is used: the number on the Pending review tab, kept up to date like the queue.
  const waiting = usePendingPassages({ limit: 1 }).data?.total ?? 0;

  const openQueue = () => {
    setSearchParams({ tab: 'pending' });
    // Requests may have come in since the number was fetched: ask again, so it matches the queue that opens.
    void queryClient.invalidateQueries({ queryKey: passageKeys.all });
  };

  return (
    <div className="space-y-8">
      {/* Switching tabs drops the page and search of the other one. */}
      <div role="tablist" aria-label="Passage lists" className="flex w-fit border border-border">
        <Tab selected={tab === 'bank'} onSelect={() => setSearchParams({})}>
          All passages
        </Tab>
        <Tab selected={tab === 'pending'} onSelect={openQueue}>
          Pending review
          {waiting > 0 && <span className="bg-primary px-1.5 text-sm text-primary-foreground">{waiting}</span>}
        </Tab>
      </div>
      {tab === 'pending' ? <PendingPassagesPanel /> : <PassageBank />}
    </div>
  );
};
