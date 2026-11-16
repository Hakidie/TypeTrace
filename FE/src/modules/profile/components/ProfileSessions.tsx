import { History } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { CompactToolbar } from '@/shared/components/compact-toolbar';
import { LoadingState } from '@/shared/components/loading-state';
import { PanelTitleSwitch } from '@/shared/components/panel-title-switch';
import { Pagination } from '@/shared/components/pagination';
import { Panel } from '@/shared/components/panel';
import { useListParams } from '@/shared/hooks/use-list-params';
import { sectionTitleClass } from '@/shared/lib/panel-styles';
import { modeLabels, formatTimeLimit } from '@/modules/typing/typing.config';
import type { SessionMode } from '@/modules/typing/types/typing.types';
import { useSessions } from '../hooks/use-profile';
import { SessionCard } from './SessionCard';

// Five rows a page.
const PAGE_SIZE = 5;

const SORT_KEYS = [
  { value: '-createdAt', key: 'newest' },
  { value: 'createdAt', key: 'oldest' },
  { value: '-wpm', key: 'fastest' },
  { value: '-accuracy', key: 'mostAccurate' },
] as const;

/**
 * The learner's completed typing sessions (SCRUM-157 profile page): a toolbar with search (by passage name), Sort, Filter (mode and time chosen) and pages, built like My Passages
 * (`CompactToolbar`, a list of cards built like the user cards of the admin area, `Pagination`). A card opens the result page of its session.
 * With `onSwitch` a button next to the title shows the error profile in its place (`PanelTitleSwitch`, the Progress page).
 */
export const ProfileSessions = ({ onSwitch }: { onSwitch?: () => void } = {}) => {
  const { t } = useTranslation('profile');
  const sortOptions = SORT_KEYS.map(({ value, key }) => ({ value, label: t(`sessions.${key}`) }));
  const modeOptions = (Object.keys(modeLabels) as SessionMode[]).map((value) => ({ value, label: modeLabels[value] }));
  const timeOptions = [10, 20, 30, 60, 120, 180].map((seconds) => ({ value: String(seconds), label: formatTimeLimit(seconds) }));
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
        <EmptyState icon={History} title={t('sessions.noMatch')} description={t('sessions.noMatchHint')} />
      ) : (
        <EmptyState icon={History} title={t('sessions.none')} description={t('sessions.noneHint')} />
      );
    }
    return (
      <>
        <div className="space-y-3" aria-label={t('sessions.cards')}>
          {sessions.data.items.map((session) => (
            <SessionCard key={session._id} session={session} />
          ))}
        </div>
        <Pagination page={sessions.data.page} totalPages={sessions.data.totalPages} onPageChange={list.setPage} variant="toolbar" accent plain flushRight />
      </>
    );
  };

  return (
    <section aria-label={t('sessions.aria')}>
      {/* PANEL My Sessions */}
      <Panel
        title={t('sessions.title')}
        titleAction={onSwitch && <PanelTitleSwitch other={t('errorProfile.switchTo')} onClick={onSwitch} />}
        bare
        titleClassName={sectionTitleClass}
        className="space-y-3"
        actions={
          <CompactToolbar
            search={{
              label: t('sessions.search'),
              placeholder: t('sessions.searchPlaceholder'),
              defaultValue: list.q,
              onSearch: (value) => list.set('q', value),
            }}
            sort={{ value: list.sort, options: sortOptions, onChange: (value) => list.set('sort', value) }}
            filters={[
              { label: t('sessions.mode'), value: mode, options: modeOptions, onChange: (value) => list.set('mode', value) },
              { label: t('sessions.time'), value: time, options: timeOptions, onChange: (value) => list.set('time', value) },
            ]}
            count={{ icon: History, value: sessions.data?.total ?? '…', label: t('sessions.count') }}
          />
        }
      >
        {renderList()}
      </Panel>
    </section>
  );
};
