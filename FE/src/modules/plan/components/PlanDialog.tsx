import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/components/ui/dialog';
import { usePlan } from '../hooks/use-plan';

const PLAN_NAMES = { free: 'Free', premium: 'Premium' } as const;

/** The day as the learner reads it, in Vietnam (the zone of the app's days). */
const formatDay = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh' });

const Permission = ({ label, allowed }: { label: string; allowed: boolean }) => (
  <li className="flex items-center justify-between gap-4">
    <span>{label}</span>
    <span className={allowed ? 'font-semibold text-primary' : 'text-muted-foreground'}>{allowed ? 'Yes' : 'No'}</span>
  </li>
);

interface PlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** What the learner's plan allows and how much of the passage limit is used. Opened from the badge on the profile and from a passage locked by the plan. */
export const PlanDialog = ({ open, onOpenChange }: PlanDialogProps) => {
  const query = usePlan();
  const plan = query.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle className="text-2xl font-bold">{plan ? `${PLAN_NAMES[plan.plan]} plan` : 'Your plan'}</DialogTitle>
        {query.isPending && <LoadingState rows={3} />}
        {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
        {plan && (
          <>
            <DialogDescription>
              {plan.expiresAt ? `Expires on ${formatDay(plan.expiresAt)}` : 'Free plan, no expiry date.'}
            </DialogDescription>
            <div className="flex items-center justify-between gap-4">
              <span>Your passages</span>
              <span className="font-semibold text-primary">{`${plan.usedPassages}/${plan.maxPassages}`}</span>
            </div>
            <ul className="space-y-2 text-base">
              <Permission label="Create error practice" allowed={plan.canCreateErrorPractice} />
              <Permission label="Practice public passages of other learners" allowed={plan.canUsePublicPassages} />
            </ul>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
