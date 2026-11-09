import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useState } from 'react';
import { z } from 'zod';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { Panel } from '@/shared/components/panel';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Switch } from '@/shared/components/ui/switch';
import { sectionTitleClass } from '@/shared/lib/panel-styles';
import { HelpLabel } from '../components/HelpLabel';
import { PlanUsersChart } from '../components/PlanUsersChart';
import { SubscriptionList } from '../components/SubscriptionList';
import { useAdminPlans, usePreviewPlans, useSavePlans } from '../hooks/use-admin-plans';
import { PASSAGE_LIMIT_HELP, PERMISSIONS, PLAN_CARDS, type PlanLines } from '../plan.config';
import type { LockPreview, PlansConfig } from '../types/plan.types';

const whole = (message: string) => z.number({ error: message }).int('Use a whole number').min(0, 'At least 0');

// Mirrors `updatePlansSchema` of the backend.
const planSchema = z.object({
  priceVnd: whole('Enter a number'),
  maxPassages: whole('Enter a number'),
  canCreateErrorPractice: z.boolean(),
  canUsePublicPassages: z.boolean(),
});
const schema = z.object({ free: planSchema, premium: planSchema });

// Number fields that look like text: no border, background or focus ring.
const bareInput = 'h-auto border-0 bg-transparent p-0 text-right shadow-none focus-visible:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

const PlansForm = ({ plans, lines, onPickLine }: { plans: PlansConfig; lines: PlanLines; onPickLine: (line: 'free' | 'premium') => void }) => {
  const preview = usePreviewPlans();
  const save = useSavePlans();
  // The saved values waiting for a confirmation, and how many users and passages they would lock.
  const [pending, setPending] = useState<{ values: PlansConfig; lock: LockPreview }>();
  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<PlansConfig>({
    resolver: zodResolver(schema),
    defaultValues: plans,
  });

  const saveValues = (values: PlansConfig) =>
    save.mutate(values, {
      onSuccess: (saved) => {
        reset(saved);
        setPending(undefined);
      },
    });

  // Asks first what the new numbers would lock; nobody to lock, saves at once.
  const submit = handleSubmit((values) =>
    preview.mutate(values, { onSuccess: (lock) => (lock.lockedUsers > 0 ? setPending({ values, lock }) : saveValues(values)) }),
  );

  const users = pending?.lock.lockedUsers ?? 0;
  const passages = pending?.lock.lockedPassages ?? 0;

  return (
    <Panel
      title="Plans"
      bare
      titleClassName={sectionTitleClass}
      className="space-y-3"
      // The Save button is on the row of the title, outside the form: `form` ties it to it.
      actions={
        <Button type="submit" form="plans-form" disabled={preview.isPending || save.isPending}>
          Save
        </Button>
      }
    >
      <form id="plans-form" onSubmit={submit} noValidate>
        <div className="grid gap-6 md:grid-cols-2">
          {PLAN_CARDS.map(({ key, name }) => (
            <fieldset
            key={key}
            aria-label={`${name} plan`}
            // A click on the card (not on a field, a switch or a "?") shows only its line on the chart; a click again shows both.
            onClick={(event) => !(event.target as HTMLElement).closest('input, button, label, [role="switch"]') && onPickLine(key)}
            className={`group cursor-pointer space-y-8 border p-4 ${lines === key ? 'border-primary' : 'border-border'}`}
          >
              <div className="flex items-start justify-between gap-4">
                <span className="text-[2rem] font-bold leading-none text-primary/70">{name}</span>
                <div className="text-right">
                  <Input
                    id={`${key}-price`}
                    aria-label={`Monthly price (${name})`}
                    type="number"
                    min={0}
                    step={1}
                    className={`${bareInput} w-52 text-[3rem] font-black leading-none text-primary`}
                    {...register(`${key}.priceVnd`, { valueAsNumber: true })}
                  />
                  <span className="block text-sm text-muted-foreground">VND/month</span>
                  {errors[key]?.priceVnd && <p className="text-sm text-destructive">{errors[key]?.priceVnd?.message}</p>}
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex min-h-9 items-center justify-between gap-4">
                  <HelpLabel
                    htmlFor={`${key}-max`}
                    text="Passage limit"
                    help={PASSAGE_LIMIT_HELP}
                  />
                  <div className="text-right">
                    <Input
                      id={`${key}-max`}
                      aria-label={`Passage limit (${name})`}
                      type="number"
                      min={0}
                      step={1}
                      className={`${bareInput} w-24 h-9 text-3xl font-black leading-none text-primary`}
                      {...register(`${key}.maxPassages`, { valueAsNumber: true })}
                    />
                    {errors[key]?.maxPassages && <p className="text-sm text-destructive">{errors[key]?.maxPassages?.message}</p>}
                  </div>
                </div>
                {PERMISSIONS.map(({ field, label, help }) => (
                  <div key={field} className="flex min-h-9 items-center justify-between gap-4">
                    <HelpLabel htmlFor={`${key}-${field}`} text={label} help={help} />
                    <Controller
                      control={control}
                      name={`${key}.${field}`}
                      render={({ field: control }) => (
                        <Switch id={`${key}-${field}`} aria-label={`${label} (${name})`} checked={control.value} onCheckedChange={control.onChange} />
                      )}
                    />
                  </div>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
  
        <ConfirmDialog
          open={pending !== undefined}
          onOpenChange={(open) => !open && setPending(undefined)}
          title="Save changes?"
          description={`${users} ${users === 1 ? 'user' : 'users'} will have passages locked (${passages} ${passages === 1 ? 'passage' : 'passages'}). Nothing is deleted: passages open again when they buy Premium or when you raise the limit.`}
          confirmLabel="Save"
          pending={save.isPending}
          onConfirm={() => pending && saveValues(pending.values)}
        />
      </form>
    </Panel>
  );
};

/**
 * The plans page (US11.1) in panels without padding, border or background: first a line chart of the users on each plan, then the cards of the Free and Premium plans (under the title Plans, with Save on its row; two columns that share the whole width) (price, passage limit and the
 * two permissions; saving first warns how many users would lose access to passages), and under them the list of every plan change of every user.
 */
export const AdminPlansPage = () => {
  const plans = useAdminPlans();
  // The lines of the users chart: a click on a plan card picks its line (a second click, or the Lines button, brings both back).
  const [lines, setLines] = useState<PlanLines>('all');

  return (
    <div className="space-y-8">
      {/* The first screen: the chart takes the height the cards leave, so the Users and Plans panels fit the screen (the screen minus the 61px header and the 2rem padding of the page above and below); the list is below it. */}
      <div className="flex min-h-[calc(100svh-61px-4rem)] flex-col gap-8">
        <PlanUsersChart lines={lines} onLinesChange={setLines} />
        {plans.data ? (
          <PlansForm plans={plans.data} lines={lines} onPickLine={(line) => setLines(lines === line ? 'all' : line)} />
        ) : (
          <Panel title="Plans" bare titleClassName={sectionTitleClass}>
            {plans.isPending && <LoadingState rows={3} />}
            {plans.isError && <ErrorState error={plans.error} onRetry={() => void plans.refetch()} />}
          </Panel>
        )}
      </div>
      <SubscriptionList />
    </div>
  );
};
