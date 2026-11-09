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
    <span className={allowed ? 'font-semibold text-primary' : 'text-muted-foreground'}>{allowed ? 'Có' : 'Không'}</span>
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
        <DialogTitle className="text-2xl font-bold">{plan ? `Gói ${PLAN_NAMES[plan.plan]}` : 'Gói của bạn'}</DialogTitle>
        {query.isPending && <LoadingState rows={3} />}
        {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
        {plan && (
          <>
            <DialogDescription>
              {plan.expiresAt ? `Hết hạn ngày ${formatDay(plan.expiresAt)}` : 'Gói miễn phí, không có ngày hết hạn.'}
            </DialogDescription>
            <div className="flex items-center justify-between gap-4">
              <span>Passage của bạn</span>
              <span className="font-semibold text-primary">{`${plan.usedPassages}/${plan.maxPassages}`}</span>
            </div>
            <ul className="space-y-2 text-base">
              <Permission label="Tạo bài luyện theo lỗi" allowed={plan.canCreateErrorPractice} />
              <Permission label="Luyện passage công khai của người khác" allowed={plan.canUsePublicPassages} />
            </ul>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
