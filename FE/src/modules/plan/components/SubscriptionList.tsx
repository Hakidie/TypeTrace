import { History } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CompactToolbar } from '@/shared/components/compact-toolbar';
import { EmptyState } from '@/shared/components/empty-state';
import { ExpandButton } from '@/shared/components/expand-button';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { Pagination } from '@/shared/components/pagination';
import { Panel } from '@/shared/components/panel';
import { PanelTitleSwitch } from '@/shared/components/panel-title-switch';
import { useListParams } from '@/shared/hooks/use-list-params';
import { sectionTitleClass } from '@/shared/lib/panel-styles';
import { useSubscriptions } from '../hooks/use-admin-plans';
import type { PlanId, SubscriptionStatus } from '../types/plan.types';
import { SubscriptionCard } from './SubscriptionCard';

// Three rows a page.
const PAGE_SIZE = 3;
// The Expand button under the list shows 10 rows a page.
const EXPANDED_PAGE_SIZE = 10;

// The options of the toolbar: a value and the key (namespace `store`) of its words.
const SORT_OPTIONS = [
  { value: '-createdAt', key: 'adminPlans.list.sort.newest' },
  { value: 'createdAt', key: 'adminPlans.list.sort.oldest' },
  { value: '-expiresAt', key: 'adminPlans.list.sort.expiresLast' },
  { value: 'expiresAt', key: 'adminPlans.list.sort.expiresFirst' },
];
// The plan names stay as they are in every language.
const PLAN_OPTIONS = [
  { value: 'free', key: 'plan.free' },
  { value: 'premium', key: 'plan.premium' },
];
// The payment methods (VNPay, MoMo...) are added here when the payments record them.
const SOURCE_OPTIONS = [{ value: 'none', key: 'adminPlans.sources.none' }];
const STATUS_OPTIONS = (['upcoming', 'active', 'cancelled', 'ended'] as const).map((value) => ({ value, key: `adminPlans.statuses.${value}` }));
const BY_OPTIONS = [
  { value: 'admin', key: 'adminPlans.changedBy.admin' },
  { value: 'system', key: 'adminPlans.changedBy.system' },
];

/**
 * Every plan change of every user (US11.1), built like My Sessions of the profile: a title and a toolbar (search by user, Sort, Filter by plan, source, status and who changed it, the total),
 * a list of cards (`SubscriptionCard`) and pages. No frame or background. With `onSwitch` a button next to the title shows the plans in its place (`PanelTitleSwitch`).
 */
export const SubscriptionList = ({ onSwitch }: { onSwitch?: () => void } = {}) => {
  const { t } = useTranslation('store');
  const words = (options: { value: string; key: string }[]) => options.map(({ value, key }) => ({ value, label: t(key) }));
  const list = useListParams({ sort: '-createdAt', prefix: 'subscriptions' });
  const [expanded, setExpanded] = useState(false);
  const plan = list.get('plan') as PlanId | '';
  const method = list.get('method') as 'none' | '';
  const by = list.get('by') as 'admin' | 'system' | '';
  const status = list.get('status') as SubscriptionStatus | '';
  const rows = useSubscriptions({
    page: list.page,
    limit: expanded ? EXPANDED_PAGE_SIZE : PAGE_SIZE,
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

  // What the box shows when there are no rows to draw: the loading, error or empty state.
  const renderState = () => {
    if (rows.isPending) return <LoadingState rows={3} />;
    if (rows.isError) return <ErrorState error={rows.error} onRetry={() => void rows.refetch()} />;
    if (rows.data.items.length === 0) {
      if (rows.data.totalPages > 0 && rows.data.page > rows.data.totalPages) return <LoadingState rows={3} />;
      return list.q || plan || method || by || status ? (
        <EmptyState icon={History} title={t('adminPlans.list.emptyFilteredTitle')} description={t('adminPlans.list.emptyFilteredHint')} />
      ) : (
        <EmptyState icon={History} title={t('adminPlans.list.emptyTitle')} description={t('adminPlans.list.emptyHint')} />
      );
    }
    return null;
  };

  return (
    <section aria-label={t('adminPlans.list.region')}>
      <Panel
        title={t('adminPlans.list.title')}
        titleAction={onSwitch && <PanelTitleSwitch other={t('adminPlans.title')} onClick={onSwitch} />}
        bare
        titleClassName={sectionTitleClass}
        className="space-y-3"
        actions={
          <CompactToolbar
            showWords
            search={{ label: t('adminPlans.list.searchLabel'), placeholder: t('adminPlans.list.searchPlaceholder'), defaultValue: list.q, onSearch: (value) => list.set('q', value) }}
            sort={{ value: list.sort, options: words(SORT_OPTIONS), onChange: (value) => list.set('sort', value) }}
            filters={[
              { label: t('adminPlans.list.plan'), value: plan, options: words(PLAN_OPTIONS), onChange: (value) => list.set('plan', value) },
              { label: t('adminPlans.list.source'), value: method, options: words(SOURCE_OPTIONS), onChange: (value) => list.set('method', value) },
              { label: t('adminPlans.list.status'), value: status, options: words(STATUS_OPTIONS), onChange: (value) => list.set('status', value) },
              { label: t('adminPlans.list.by'), value: by, options: words(BY_OPTIONS), onChange: (value) => list.set('by', value) },
            ]}
            count={{ icon: History, value: rows.data?.total ?? '…', label: t('adminPlans.list.changes') }}
          />
        }
      >
        {/* -mx-4: the 16px padding of the cards goes outside, so their text lines up with the title and the toolbar. */}
        <div className="-mx-4 space-y-3" aria-label={t('adminPlans.list.cards')}>
          {rows.data && rows.data.items.length > 0
            ? rows.data.items.map((row) => (
                <SubscriptionCard key={row._id} row={row} />
              ))
            : renderState()}
        </div>
        {rows.data && rows.data.items.length > 0 && (
          <div className="flex items-center justify-between">
            {/* Bottom left: 10 rows a page instead of 3 (shown while there is more than the 3 rows to see). */}
            {(expanded || rows.data.total > PAGE_SIZE) && (
              <ExpandButton
                expanded={expanded}
                onToggle={() => {
                  setExpanded(!expanded);
                  list.setPage(1);
                }}
              />
            )}
            <Pagination page={rows.data.page} totalPages={rows.data.totalPages} onPageChange={list.setPage} variant="toolbar" accent plain flushRight />
          </div>
        )}
      </Panel>
    </section>
  );
};
