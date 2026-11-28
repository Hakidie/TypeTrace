import { useTranslation } from 'react-i18next';
import { Receipt } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { ListRow, ListRowStat } from '@/shared/components/list-row';
import { LoadingState } from '@/shared/components/loading-state';
import { Pagination } from '@/shared/components/pagination';
import { Panel } from '@/shared/components/panel';
import { PanelTitleSwitch } from '@/shared/components/panel-title-switch';
import { usePagination } from '@/shared/hooks/use-pagination';
import { sectionTitleClass } from '@/shared/lib/panel-styles';
import { useMyPayments, usePaymentProducts } from '../hooks/use-payments';
import { formatVnd, PROVIDER_NAMES, purchaseLabel } from '../lib/store';

const PAGE_SIZE = 6;
const dateTime = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
});

/** The learner's own payments, newest first (`/store/history`). A failed, cancelled or expired try is listed but never changed the plan or the coins. */
export const PaymentHistoryPage = () => {
  const { t } = useTranslation('store');
  const navigate = useNavigate();
  const { page, setPage } = usePagination();
  const rows = useMyPayments(page, PAGE_SIZE);
  const products = usePaymentProducts();

  return (
    <div className="flex flex-1 flex-col">
      <Panel title={t('history.title')} bare titleClassName={sectionTitleClass} className="space-y-3">
        {rows.isPending && <LoadingState rows={3} />}
        {rows.isError && <ErrorState error={rows.error} onRetry={() => void rows.refetch()} />}
        {rows.data && rows.data.items.length === 0 && <EmptyState icon={Receipt} title={t('history.emptyTitle')} description={t('history.emptyHint')} />}
        {rows.data && rows.data.items.length > 0 && (
          <>
            <div className="-mx-4 space-y-3" aria-label={t('history.payments')}>
              {rows.data.items.map((row) => (
                <ListRow
                  key={row._id}
                  plain
                  flat
                  extraBeside
                  identity={
                    <div className="min-w-0">
                      <p className="truncate text-2xl font-extrabold text-primary/80">{purchaseLabel(row.product, products.data)}</p>
                      <p className="truncate text-lg text-muted-foreground">{dateTime.format(new Date(row.createdAt))}</p>
                    </div>
                  }
                  extra={
                    // A phone held upright: the three under the name, left-aligned with it (a value never breaks across lines); from `sm` on the line of the name, in columns wide enough for the amount.
                    <div className="flex w-full justify-start gap-5 whitespace-nowrap sm:w-auto sm:justify-end sm:gap-8">
                      <ListRowStat compactOnPhones startOnPhones className="sm:w-40" label={t('history.amount')} value={formatVnd(row.amount)} />
                      <ListRowStat compactOnPhones startOnPhones className="sm:w-28" label={t('history.gateway')} value={PROVIDER_NAMES[row.provider]} />
                      <ListRowStat compactOnPhones startOnPhones className="sm:w-28" label={t('history.status')} value={t(`history.${row.status}`)} />
                    </div>
                  }
                />
              ))}
            </div>
            <Pagination page={rows.data.page} totalPages={rows.data.totalPages} onPageChange={setPage} variant="toolbar" accent plain flushRight />
          </>
        )}
      </Panel>
      <div className="mt-auto mb-4 flex shrink-0 items-center justify-center pt-3">
        <PanelTitleSwitch other={t('history.store')} showLabel onClick={() => navigate('/store')} />
      </div>
    </div>
  );
};
