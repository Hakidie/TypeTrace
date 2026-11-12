import { Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePaymentProducts } from '@/modules/payments/hooks/use-payments';
import { formatVnd, pricePerMonth, proPlans } from '@/modules/payments/lib/store';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/components/ui/dialog';
import { usePlan } from '../hooks/use-plan';
import { PLAN_CARDS } from '../plan.config';
import { PlanOfferCard } from './PlanOfferCard';

interface PlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Free and Premium side by side (`PlanOfferCard`), the learner's own outlined and tagged "Your plan". Opened from the badge
 * on the profile and from what a plan locks (a passage, Train). Free is not sold, so only Premium has a button: "Get Premium"
 * (or "Extend Premium" on it) closes the dialog and opens the Store, where it is paid with VNPay or MoMo (`modules/payments`).
 * A solid panel without the dark screen over the page: the page stays in place, the plans read cleanly on top of it.
 */
export const PlanDialog = ({ open, onOpenChange }: PlanDialogProps) => {
  const navigate = useNavigate();
  const query = usePlan();
  const plan = query.data;
  // The cheapest month on a longer term, from the Store's real prices: "or 75.250 ₫ a month with 12 months".
  const products = usePaymentProducts();
  const longest = proPlans(products.data ?? []).at(-1);
  const longTermNote =
    longest && plan && longest.grant.months > 1 && pricePerMonth(longest) < plan.plans.premium.priceVnd
      ? `or ${formatVnd(pricePerMonth(longest))} a month with ${longest.grant.months} months`
      : undefined;
  const toStore = () => {
    onOpenChange(false);
    navigate('/store');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlay={false}
        // Focus goes to the dialog itself, not to the first "?" (which would open its tooltip at once); Tab then walks the dialog.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement).focus();
        }}
        className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto border-border bg-background p-0 shadow-xl outline-none sm:max-w-4xl"
      >
        <div className="space-y-1 border-b px-6 pt-6 pb-5 pr-14">
          <DialogTitle className="text-2xl font-bold tracking-tight">Plans</DialogTitle>
          <DialogDescription>Premium opens more passages, Train and the Dragon set. You pay once, nothing renews by itself.</DialogDescription>
        </div>
        {query.isPending && (
          <div className="p-6">
            <LoadingState rows={3} />
          </div>
        )}
        {query.isError && (
          <div className="p-6">
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          </div>
        )}
        {plan && (
          // Free is the narrow reference on the left, Premium the wide offer on the right (stacked on phones).
          <div className="grid gap-px bg-border md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            {PLAN_CARDS.map(({ key, name }, order) => {
              const owned = plan.plan === key;
              const premium = key === 'premium';
              const action = premium ? (
                // The one button to press: a band of light crosses it now and then (`plan-sheen`), the crown lifts on hover.
                <Button type="button" className="plan-sheen group/cta relative h-12 w-full overflow-hidden text-base active:scale-[0.98]" onClick={toStore}>
                  <Crown className="size-5 transition-transform duration-200 group-hover/cta:-translate-y-0.5 group-hover/cta:-rotate-12 motion-reduce:transition-none" aria-hidden="true" />
                  {owned ? 'Extend Premium' : 'Get Premium'}
                </Button>
              ) : undefined;
              return (
                <div key={key} className="bg-background">
                  <PlanOfferCard
                    planKey={key}
                    name={name}
                    config={plan.plans[key]}
                    current={owned}
                    used={plan.usedPassages}
                    priceNote={premium ? longTermNote : undefined}
                    action={action}
                    order={order}
                  />
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
