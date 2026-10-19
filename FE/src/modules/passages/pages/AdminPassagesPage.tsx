import { FileText } from 'lucide-react';
import { useRef, useState } from 'react';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { Pagination } from '@/shared/components/pagination';
import { Panel } from '@/shared/components/panel';
import { usePagination } from '@/shared/hooks/use-pagination';
import { panelBodyClass, panelTitleClass } from '@/shared/lib/panel-styles';
import { PassageCard } from '../components/PassageCard';
import { PassageForm } from '../components/PassageForm';
import { usePassages } from '../hooks/use-passages';
import type { Passage } from '../types/passage.types';

const PAGE_SIZE = 9;

// A fixed sample card so the layout is visible before real passages exist. It is not stored anywhere.
const EXAMPLE_PASSAGE: Passage = {
  _id: 'example',
  title: 'Phố cổ buổi sớm',
  content: 'Sương còn đọng trên mái ngói rêu phong, tiếng rao hàng vang lên khe khẽ giữa con phố nhỏ. Người ta đi chậm lại để nghe thành phố thức dậy.',
  source: 'Wikipedia',
  ownerName: 'TypeTrace',
  status: 'published',
  isPlacement: true,
  wordCount: 28,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export const AdminPassagesPage = () => {
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
    <div className="space-y-8">
      <div ref={formPanelRef} className="scroll-mt-4">
        <Panel title={editing ? 'Edit passage' : 'New passage'} bare titleClassName={panelTitleClass} className={panelBodyClass}>
          {/* `key` remounts the form, so it starts from the passage being edited (or empty). */}
          <PassageForm key={editing?._id ?? 'new'} passage={editing ?? undefined} onDone={() => setEditing(null)} />
        </Panel>
      </div>
      <Panel title="Passages" bare titleClassName={panelTitleClass} className={panelBodyClass}>
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Example passage">
            <PassageCard passage={EXAMPLE_PASSAGE} />
          </div>
          {renderList()}
        </div>
      </Panel>
    </div>
  );
};
