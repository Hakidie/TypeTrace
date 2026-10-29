import { History } from 'lucide-react';
import { useEffect } from 'react';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { CompactToolbar } from '@/shared/components/compact-toolbar';
import { LoadingState } from '@/shared/components/loading-state';
import { Pagination } from '@/shared/components/pagination';
import { Panel } from '@/shared/components/panel';
import { useListParams } from '@/shared/hooks/use-list-params';
import { sectionTitleClass } from '@/shared/lib/panel-styles';
import { modeLabels, formatTimeLimit } from '@/modules/typing/typing.config';
import type { SessionMode } from '@/modules/typing/types/typing.types';
import { useSessions } from '../hooks/use-profile';
import { SessionCard } from './SessionCard';

// Three rows like the user list of the admin area.
const PAGE_SIZE = 3;

const SORT_OPTIONS = [
  { value: '-createdAt', label: 'Newest' },
  { value: 'createdAt', label: 'Oldest' },
  { value: '-wpm', label: 'Fastest' },
  { value: '-accuracy', label: 'Most accurate' },
];

const MODE_OPTIONS = (Object.keys(modeLabels) as SessionMode[]).map((value) => ({ value, label: modeLabels[value] }));

// The time choices of the Typing page.
const TIME_OPTIONS = [10, 20, 30, 60, 120, 180].map((seconds) => ({ value: String(seconds), label: formatTimeLimit(seconds) }));

/**
 * The learner's completed typing sessions (SCRUM-157 profile page): a toolbar with search (by passage name), Sort, Filter (mode and time chosen) and pages, built like My Passages
 * (`CompactToolbar`, a list of cards built like the user cards of the admin area, `Pagination`). A card opens the result page of its session.
 */
export const ProfileSessions = () => {
  const list = useListParams({ sort: '-createdAt', prefix: 'sessions' });
  const mode = list.get('mode') as SessionMode | '';
  const time = list.get('time');
  const sessions = useSessions({
    page: list.page,
    limit: PAGE_SIZE,
    sort: list.sort,
    status: 'completed',
    q: list.q || undefined,
    mode: mode || undefined,
    timeLimitSeconds: time ? Number(time) : undefined,
  });

  // A page past the end (an old link) goes back to the last page, but not while the previous list is still on screen.
  const { page, setPage } = list;
  const lastPage = sessions.isPlaceholderData ? 0 : (sessions.data?.totalPages ?? 0);
  useEffect(() => {
    if (lastPage > 0 && page > lastPage) setPage(lastPage);
  }, [lastPage, page, setPage]);

  const renderList = () => {
    if (sessions.isPending) return <LoadingState rows={3} />;
    if (sessions.isError) return <ErrorState error={sessions.error} onRetry={() => void sessions.refetch()} />;
    if (sessions.data.items.length === 0) {
      if (sessions.data.totalPages > 0 && sessions.data.page > sessions.data.totalPages) return <LoadingState rows={3} />;
      return list.q || mode || time ? (
        <EmptyState icon={History} title="No matching sessions" description="Try another search or filter." />
      ) : (
        <EmptyState icon={History} title="No sessions yet" description="Finish a session on the Typing page to see it here." />
      );
    }
    return (
      <>
        <div className="space-y-3" aria-label="Session cards">
          {sessions.data.items.map((session) => (
            <SessionCard key={session._id} session={session} />
          ))}
        </div>
        <Pagination page={sessions.data.page} totalPages={sessions.data.totalPages} onPageChange={list.setPage} variant="toolbar" accent plain flushRight />
      </>
    );
  };

  return (
    <section aria-label="My sessions">
      <Panel
        title="My Sessions"
        bare
        titleClassName={sectionTitleClass}
        className="space-y-3"
        actions={
          <CompactToolbar
            search={{
              label: 'Search sessions',
              placeholder: 'Passage name',
              defaultValue: list.q,
              onSearch: (value) => list.set('q', value),
            }}
            sort={{ value: list.sort, options: SORT_OPTIONS, onChange: (value) => list.set('sort', value) }}
            filters={[
              { label: 'Mode', value: mode, options: MODE_OPTIONS, onChange: (value) => list.set('mode', value) },
              { label: 'Time', value: time, options: TIME_OPTIONS, onChange: (value) => list.set('time', value) },
            ]}
            count={{ icon: History, value: sessions.data?.total ?? '…', label: 'Sessions' }}
          />
        }
      >
        {renderList()}
      </Panel>
    </section>
  );
};
