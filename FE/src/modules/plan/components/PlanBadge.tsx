import { useState } from 'react';
import { Badge } from '@/shared/components/ui/badge';
import { usePlan } from '../hooks/use-plan';
import { PlanDialog } from './PlanDialog';

const LABELS = { free: 'Free', premium: 'Premium' } as const;

/**
 * The learner's plan as a badge next to their name (Free or Premium). It opens `PlanDialog`. Nothing shows while the plan
 * loads; when it cannot load the badge reads "Plan" and the dialog shows the error.
 */
export const PlanBadge = () => {
  const { data, isPending } = usePlan();
  const [open, setOpen] = useState(false);
  // While the dialog is open the badge stays: opening it asks for the plan again, which is `pending` for a moment after an error.
  if (isPending && !open) return null;

  return (
    <>
      <Badge asChild variant={data?.plan === 'premium' ? 'default' : 'outline'}>
        <button type="button" onClick={() => setOpen(true)} className="shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {data ? LABELS[data.plan] : 'Plan'}
        </button>
      </Badge>
      {/* Mounted only while open: its own `usePlan` would otherwise ask again as soon as the badge shows an error. */}
      {open && <PlanDialog open onOpenChange={setOpen} />}
    </>
  );
};
