import { RefreshCw } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { ListRow, ListRowStat } from '@/shared/components/list-row';
import { canRecheck, formatVnd, PROVIDER_NAMES } from '../lib/store';
import type { AdminPaymentRow } from '../types/payments.types';

const STATUS_NAMES: Record<AdminPaymentRow['status'], string> = { pending: 'Pending', paid: 'Paid', failed: 'Failed' };

const dateTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

/** One payment of a user: who, what and how much on the left, the gateway, the state and whether it was given on the right. */
export const AdminPaymentCard = ({ row, onRecheck, checking }: { row: AdminPaymentRow; onRecheck: (row: AdminPaymentRow) => void; checking: boolean }) => (
  <ListRow
    plain
    flat
    identity={
      <div className="min-w-0">
        <p className="truncate text-2xl font-extrabold text-primary/80">{row.userName}</p>
        <p className="truncate text-lg text-muted-foreground">{row.email ?? ''}</p>
      </div>
    }
    center={
      <div className="min-w-0 text-center">
        <p className="truncate text-lg font-semibold">{row.product}</p>
        <p className="text-sm text-muted-foreground">{dateTime.format(new Date(row.createdAt))}</p>
      </div>
    }
    extra={
      <div className="flex w-full justify-between gap-4 xl:w-auto xl:justify-end xl:gap-0">
        <ListRowStat className="w-32" label="AMOUNT" value={formatVnd(row.amount)} />
        <ListRowStat className="w-28" label="GATEWAY" value={PROVIDER_NAMES[row.provider]} />
        <ListRowStat className="w-28" label="STATUS" value={STATUS_NAMES[row.status]} />
        <ListRowStat className="w-28" label="GIVEN" value={row.status === 'paid' ? (row.granted ? 'Yes' : 'Not yet') : '-'} />
      </div>
    }
    action={
      canRecheck(row) ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button type="button" variant="ghost" size="sm" aria-label="Check again with payOS" disabled={checking} onClick={() => onRecheck(row)}>
                  <RefreshCw className={checking ? 'animate-spin' : ''} aria-hidden="true" />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Check again with payOS</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : undefined
    }
  />
);
