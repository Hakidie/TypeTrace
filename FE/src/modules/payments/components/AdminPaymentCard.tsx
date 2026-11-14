import { RefreshCw } from 'lucide-react';
import { AvatarSprite } from '@/modules/avatar/components/AvatarSprite';
import { Button } from '@/shared/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { ListRow } from '@/shared/components/list-row';
import { canRecheck, PROVIDER_NAMES, purchaseLabel } from '../lib/store';
import type { AdminPaymentRow, PaymentProduct } from '../types/payments.types';

const STATUS_NAMES: Record<AdminPaymentRow['status'], string> = { pending: 'Pending', paid: 'Paid', failed: 'Failed' };

const dayFormat = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
const timeFormat = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' });
/** The day goes under the plan ("13/11/2026"), the time under the gateway ("12:18 UTC"). */
const dayOf = (iso: string) => dayFormat.format(new Date(iso));
const timeOf = (iso: string) => `${timeFormat.format(new Date(iso))} UTC`;

/** What a payment bought: "Premium-6M" for a Premium term, the catalog's label for anything else ("500 coins"). */
const planName = (productId: string, products?: PaymentProduct[]) => {
  const grant = products?.find((product) => product.id === productId)?.grant;
  return grant?.kind === 'premium' ? `Premium-${grant.months}M` : purchaseLabel(productId, products);
};

/** The four columns of a row share the width left by the buyer equally. */
const COLUMNS = 'grid w-full grid-cols-4 gap-x-10';

/** A right-aligned column built like the buyer's: a bold line on top, a muted one under it. */
const Cell = ({ top, bottom }: { top: string; bottom?: string }) => (
  <div className="min-w-0 text-right">
    <p className="truncate text-2xl font-extrabold text-primary/80 first-letter:uppercase">{top}</p>
    {bottom !== undefined && <p className="truncate text-lg text-muted-foreground">{bottom}</p>}
  </div>
);

/** One payment of a user: the buyer with their avatar, then Plan over the day, Gateway over the time, Amount, and Status over Access in equal columns, all right-aligned. */
export const AdminPaymentCard = ({
  row,
  products,
  onRecheck,
  checking,
}: {
  row: AdminPaymentRow;
  products?: PaymentProduct[];
  onRecheck: (row: AdminPaymentRow) => void;
  checking: boolean;
}) => (
  <ListRow
    plain
    flat
    stretch
    identity={
      <div className="flex min-w-0 items-center gap-3">
        {/* 61px = the height of the columns. The uploaded picture, or the pixel face of the account. */}
        <div className="flex size-[61px] shrink-0 items-center justify-center overflow-hidden">
          {row.avatarUrl ? <img src={row.avatarUrl} alt="" className="size-full object-cover" /> : <AvatarSprite look={row.avatar} crop="head" scale={1.5} label={`Avatar of ${row.userName}`} />}
        </div>
        <div className="min-w-0">
          <p className="truncate text-2xl font-extrabold text-primary/80">{row.userName}</p>
          <p className="truncate text-lg text-muted-foreground">{row.email ?? ''}</p>
        </div>
      </div>
    }
    extra={
      <div className={COLUMNS}>
        <Cell top={planName(row.product, products)} bottom={dayOf(row.createdAt)} />
        <Cell top={PROVIDER_NAMES[row.provider]} bottom={timeOf(row.createdAt)} />
        <Cell top={new Intl.NumberFormat('vi-VN').format(row.amount)} bottom="₫" />
        <Cell top={STATUS_NAMES[row.status]} bottom={`Access: ${row.status !== 'paid' ? 'No' : row.granted ? 'Yes' : 'Not yet'}`} />
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
