import { History } from 'lucide-react';
import { useEffect } from 'react';
import { CompactToolbar } from '@/shared/components/compact-toolbar';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { Pagination } from '@/shared/components/pagination';
import { Panel } from '@/shared/components/panel';
import { useListParams } from '@/shared/hooks/use-list-params';
import { sectionTitleClass } from '@/shared/lib/panel-styles';
import { useSubscriptions } from '../hooks/use-admin-plans';
import type { PlanId, SubscriptionStatus } from '../types/plan.types';
import { SubscriptionCard } from './SubscriptionCard';

// Nine rows a page.
const PAGE_SIZE = 9;

const SORT_OPTIONS = [
  { value: '-createdAt', label: 'Newest' },
  { value: 'createdAt', label: 'Oldest' },
  { value: '-expiresAt', label: 'Expires last' },
  { value: 'expiresAt', label: 'Expires first' },
];
const PLAN_OPTIONS = [
  { value: 'free', label: 'Free' },
  { value: 'premium', label: 'Premium' },
];
// The payment methods (VNPay, MoMo...) are added here when the payments record them.
const SOURCE_OPTIONS = [{ value: 'none', label: 'None' }];
const STATUS_OPTIONS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'active', label: 'Active' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'ended', label: 'Ended' },
];
const BY_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'system', label: 'System' },
];

/**
 * Every plan change of every user (US11.1), built like My Sessions of the profile: a title and a toolbar (search by user, Sort, Filter by plan, source, status and who changed it, the total),
 * a list of cards (`SubscriptionCard`) and pages. No frame or background.
 */
export const SubscriptionList = () => {
  const list = useListParams({ sort: '-createdAt', prefix: 'subscriptions' });
  const plan = list.get('plan') as PlanId | '';
  const method = list.get('method') as 'none' | '';
  const by = list.get('by') as 'admin' | 'system' | '';
  const status = list.get('status') as SubscriptionStatus | '';
  const rows = useSubscriptions({
    page: list.page,
    limit: PAGE_SIZE,
    sort: list.sort,
    q: list.q || undefined,
    plan: plan || undefined,
    method: method || undefined,
    by: by || undefined,
    status: status || undefined,
  });

  // A page past the end (an old link) goes back to the last page, but not while the previous list is still on screen.
  const { page, setPage } = list;
  const lastPage = rows.isPlaceholderData ? 0 : (rows.data?.totalPages ?? 0);
  useEffect(() => {
    if (lastPage > 0 && page > lastPage) setPage(lastPage);
  }, [lastPage, page, setPage]);

  const renderList = () => {
    if (rows.isPending) return <LoadingState rows={9} />;
    if (rows.isError) return <ErrorState error={rows.error} onRetry={() => void rows.refetch()} />;
    if (rows.data.items.length === 0) {
      if (rows.data.totalPages > 0 && rows.data.page > rows.data.totalPages) return <LoadingState rows={9} />;
      return list.q || plan || method || by || status ? (
        <EmptyState icon={History} title="No matching plan changes" description="Try another search or filter." />
      ) : (
        <EmptyState icon={History} title="No plan changes yet" description="Every time a user's plan changes, it shows here." />
      );
    }
    return (
      <>
        <div className="-mx-4 space-y-3" aria-label="Subscription cards">
          {rows.data.items.map((row) => (
            <SubscriptionCard key={row._id} row={row} />
          ))}
        </div>
        <Pagination page={rows.data.page} totalPages={rows.data.totalPages} onPageChange={list.setPage} variant="toolbar" accent plain flushRight />
      </>
    );
  };

  return (
    <section aria-label="Subscriptions">
      <Panel
        title="Subscription list"
        bare
        titleClassName={sectionTitleClass}
        className="space-y-3"
        actions={
          <CompactToolbar
            showWords
            search={{ label: 'Search users', placeholder: 'User name', defaultValue: list.q, onSearch: (value) => list.set('q', value) }}
            sort={{ value: list.sort, options: SORT_OPTIONS, onChange: (value) => list.set('sort', value) }}
            filters={[
              { label: 'Plan', value: plan, options: PLAN_OPTIONS, onChange: (value) => list.set('plan', value) },
              { label: 'Source', value: method, options: SOURCE_OPTIONS, onChange: (value) => list.set('method', value) },
              { label: 'Status', value: status, options: STATUS_OPTIONS, onChange: (value) => list.set('status', value) },
              { label: 'By', value: by, options: BY_OPTIONS, onChange: (value) => list.set('by', value) },
            ]}
            count={{ icon: History, value: rows.data?.total ?? '…', label: 'Changes' }}
          />
        }
      >
        {renderList()}
      </Panel>
    </section>
  );
};
