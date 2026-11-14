import { CreditCard } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CompactToolbar } from '@/shared/components/compact-toolbar';
import { EmptyState } from '@/shared/components/empty-state';
import { ExpandButton } from '@/shared/components/expand-button';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { Pagination } from '@/shared/components/pagination';
import { Panel } from '@/shared/components/panel';
import { useListParams } from '@/shared/hooks/use-list-params';
import { sectionTitleClass } from '@/shared/lib/panel-styles';
import { PaymentRevenueChart } from '../components/PaymentRevenueChart';
import { AdminPaymentCard } from '../components/AdminPaymentCard';
import { useAdminPayments, usePaymentProducts, useRecheckPayment } from '../hooks/use-payments';
import type { AdminPaymentRow, PaymentProvider } from '../types/payments.types';

// 3 rows a page; the Expand button under the list shows 10.
const PAGE_SIZE = 3;
const EXPANDED_PAGE_SIZE = 10;
const SORT_OPTIONS = [
  { value: '-createdAt', label: 'Newest' },
  { value: 'createdAt', label: 'Oldest' },
  { value: '-amount', label: 'Highest amount' },
  { value: 'amount', label: 'Lowest amount' },
];
const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'failed', label: 'Failed' },
];
const GATEWAY_OPTIONS = [
  { value: 'payos', label: 'payOS' },
  { value: 'vnpay', label: 'VNPay' },
  { value: 'momo', label: 'MoMo' },
];

/**
 * Every payment of every user (VNPay, MoMo, payOS): who paid what, its state and whether the learner got it. A payOS payment
 * that is still open (or paid but not given) has a button that asks payOS again, for a learner who paid and closed the page.
 */
export const AdminPaymentsPage = () => {
  const list = useListParams({ sort: '-createdAt' });
  const [expanded, setExpanded] = useState(false);
  const pageSize = expanded ? EXPANDED_PAGE_SIZE : PAGE_SIZE;
  const status = list.get('status') as AdminPaymentRow['status'] | '';
  const provider = list.get('provider') as PaymentProvider | '';
  const rows = useAdminPayments({ page: list.page, limit: pageSize, sort: list.sort, q: list.q || undefined, status: status || undefined, provider: provider || undefined });
  const products = usePaymentProducts();
  const recheck = useRecheckPayment();

  // A page past the end (an old link) goes back to the last page.
  const { page, setPage } = list;
  const lastPage = rows.isPlaceholderData ? 0 : (rows.data?.totalPages ?? 0);
  useEffect(() => {
    if (lastPage > 0 && page > lastPage) setPage(lastPage);
  }, [lastPage, page, setPage]);

  const renderState = () => {
    if (rows.isPending) return <LoadingState rows={3} />;
    if (rows.isError) return <ErrorState error={rows.error} onRetry={() => void rows.refetch()} />;
    if (rows.data.items.length === 0) {
      if (rows.data.totalPages > 0 && rows.data.page > rows.data.totalPages) return <LoadingState rows={3} />;
      return list.q || status || provider ? (
        <EmptyState icon={CreditCard} title="No matching payments" description="Try another search or filter." />
      ) : (
        <EmptyState icon={CreditCard} title="No payments yet" description="Every try to pay shows here." />
      );
    }
    return null;
  };

  return (
    // The chart takes the height the list leaves, so both fit the screen (the screen minus the 61px header and the 2rem padding of the page above and below).
    <div className="flex min-h-[calc(100svh-61px-4rem)] flex-col gap-8">
      <PaymentRevenueChart />
      <Panel
        title="Payment list"
        bare
        titleClassName={sectionTitleClass}
        className="space-y-3"
        actions={
          <CompactToolbar
            showWords
            search={{ label: 'Search users', placeholder: 'User name', defaultValue: list.q, onSearch: (value) => list.set('q', value) }}
            sort={{ value: list.sort, options: SORT_OPTIONS, onChange: (value) => list.set('sort', value) }}
            filters={[
              { label: 'Status', value: status, options: STATUS_OPTIONS, onChange: (value) => list.set('status', value) },
              { label: 'Gateway', value: provider, options: GATEWAY_OPTIONS, onChange: (value) => list.set('provider', value) },
            ]}
            count={{ icon: CreditCard, value: rows.data?.total ?? '…', label: 'Payments' }}
          />
        }
      >
        <div className="-mx-4 space-y-3" aria-label="Payment cards">
          {rows.data && rows.data.items.length > 0
            ? rows.data.items.map((row) => (
                <AdminPaymentCard key={row._id} row={row} products={products.data} checking={recheck.isPending && recheck.variables === row._id} onRecheck={(item) => recheck.mutate(item._id)} />
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
    </div>
  );
};
