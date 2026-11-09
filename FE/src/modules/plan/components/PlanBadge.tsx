import { useState } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { usePlan } from '../hooks/use-plan';
import { PlanDialog } from './PlanDialog';

const LABELS = { free: 'Free', premium: 'Premium' } as const;

/**
 * The learner's plan as a button with the word FREE or PREMIUM next to their name, between the name and the pencil (Free: muted, Premium: red; the tooltip and the
 * accessible name say which). It opens `PlanDialog`. Nothing shows while the plan loads; when it cannot load the name is "Plan" and the dialog shows the error.
 */
export const PlanBadge = () => {
  const { data, isPending } = usePlan();
  const [open, setOpen] = useState(false);
  // While the dialog is open the badge stays: opening it asks for the plan again, which is `pending` for a moment after an error.
  if (isPending && !open) return null;

  return (
    <>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            {/* The look of the pencil beside it (32px high, a red tint while hovered): the word FREE (muted) or PREMIUM (red), always shown. */}
            <button
              type="button"
              aria-label={data ? LABELS[data.plan] : 'Plan'}
              onClick={() => setOpen(true)}
              className={cn(
                'flex h-8 shrink-0 cursor-pointer items-center justify-center px-2 text-sm font-bold tracking-widest transition-colors hover:bg-primary/15 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                data?.plan === 'premium' ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              {data ? LABELS[data.plan].toUpperCase() : 'PLAN'}
            </button>
          </TooltipTrigger>
          <TooltipContent>{data ? `${LABELS[data.plan]} plan` : 'Plan'}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {/* Mounted only while open: its own `usePlan` would otherwise ask again as soon as the badge shows an error. */}
      {open && <PlanDialog open onOpenChange={setOpen} />}
    </>
  );
};
