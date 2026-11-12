import { useNavigate } from 'react-router-dom';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/shared/components/ui/dialog';
import { usePlan } from '../hooks/use-plan';
import { PLAN_CARDS } from '../plan.config';
import { PlanOfferCard } from './PlanOfferCard';

interface PlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The two plans side by side, as the admin sees them (`PlanOfferCard`), the learner's own outlined, and in each card, at the bottom, its button: "Buy now" on Premium, "Owned" (disabled) on the card of the plan the learner has (Free has no button
 * for a learner on Premium). Opened from the badge on the profile and from a passage locked by the plan. "Buy now" closes it and opens the Store,
 * where Premium is paid with VNPay or MoMo (`modules/payments`).
 */
export const PlanDialog = ({ open, onOpenChange }: PlanDialogProps) => {
  const navigate = useNavigate();
  const query = usePlan();
  const plan = query.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* The look of the shared tooltip (see-through page background with blur, panel border), as the menus, without the dark screen over the page; the top padding is a band of its own for the close button, so it does not touch the cards. */}
      <DialogContent overlay={false} className="border-border bg-background/75 pt-12 shadow-md backdrop-blur-xs sm:max-w-4xl" aria-describedby={undefined}>
        {/* No visible title: the cards say it all; screen readers still get the name of the dialog. */}
        <DialogTitle className="sr-only">Plans</DialogTitle>
        {query.isPending && <LoadingState rows={3} />}
        {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
        {plan && (
          <div className="grid gap-6 md:grid-cols-2">
            {PLAN_CARDS.map(({ key, name }) => {
              const owned = plan.plan === key;
              // The Free card shows a button only to the learner who is on it: Free is not sold.
              const action =
                key === 'free' && !owned ? undefined : (
                  <Button
                    type="button"
                    className="w-full"
                    disabled={owned}
                    onClick={() => {
                      onOpenChange(false);
                      navigate('/store');
                    }}
                  >
                    {owned ? 'Owned' : 'Buy now'}
                  </Button>
                );
              return <PlanOfferCard key={key} id={`offer-${key}`} planKey={key} name={name} config={plan.plans[key]} current={owned} used={plan.usedPassages} action={action} />;
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
