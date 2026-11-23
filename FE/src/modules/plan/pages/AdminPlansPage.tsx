import { zodResolver } from '@hookform/resolvers/zod';
import type { TFunction } from 'i18next';
import { Controller, useForm } from 'react-hook-form';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { Panel } from '@/shared/components/panel';
import { PanelTitleSwitch } from '@/shared/components/panel-title-switch';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Switch } from '@/shared/components/ui/switch';
import { sectionTitleClass } from '@/shared/lib/panel-styles';
import { FitAvatar } from '../components/FitAvatar';
import { HelpLabel } from '../components/HelpLabel';
import { PlanUsersChart } from '../components/PlanUsersChart';
import { SubscriptionList } from '../components/SubscriptionList';
import { useAdminPlans, usePreviewPlans, useSavePlans } from '../hooks/use-admin-plans';
import { PERMISSIONS, PLAN_AVATARS, PLAN_CARDS, type PlanLines } from '../plan.config';
import type { LockPreview, PlansConfig } from '../types/plan.types';

// Mirrors `updatePlansSchema` of the backend; the messages are in the language of the interface.
const schemaOf = (t: TFunction<'store'>) => {
  const whole = () => z.number({ error: t('adminPlans.form.enterNumber') }).int(t('adminPlans.form.wholeNumber')).min(0, t('adminPlans.form.atLeastZero'));
  const planSchema = z.object({
    priceVnd: whole(),
    maxPassages: whole(),
    canCreateErrorPractice: z.boolean(),
    canUsePublicPassages: z.boolean(),
  });
  return z.object({ free: planSchema, premium: planSchema });
};

// Number fields that look like text: no border, background or focus ring.
// The label of an option: may wrap, its size follows the width of the card (so the avatar and the switch always have room).
const optionLabel = 'text-[clamp(0.875rem,4.4cqw,1.5rem)] font-semibold leading-none tracking-wide text-primary/70';
const bareInput = 'h-auto border-0 bg-transparent p-0 text-right shadow-none focus-visible:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

const PlansForm = ({
  plans,
  lines,
  onPickLine,
  onSwitch,
}: {
  plans: PlansConfig;
  lines: PlanLines;
  onPickLine: (line: 'free' | 'premium') => void;
  onSwitch: () => void;
}) => {
  const { t } = useTranslation('store');
  const schema = useMemo(() => schemaOf(t), [t]);
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
      title={t('adminPlans.title')}
      titleAction={<PanelTitleSwitch other={t('adminPlans.list.title')} onClick={onSwitch} />}
      bare
      titleClassName={sectionTitleClass}
      className="space-y-3"
      // The Save button is on the row of the title, outside the form: `form` ties it to it.
      actions={
        <Button type="submit" form="plans-form" disabled={preview.isPending || save.isPending}>
          {t('adminPlans.save')}
        </Button>
      }
    >
      <form id="plans-form" onSubmit={submit} noValidate>
        <div className="grid gap-6 md:grid-cols-2">
          {PLAN_CARDS.map(({ key, name }) => (
            <fieldset
            key={key}
            aria-label={t('plan.planSuffix', { name })}
            // A click on the card (not on a field, a switch or a "?") shows only its line on the chart; a click again shows both.
            onClick={(event) => !(event.target as HTMLElement).closest('input, button, label, [role="switch"]') && onPickLine(key)}
            className={`group @container min-w-0 cursor-pointer border p-4 ${lines === key ? 'border-primary' : 'border-border'}`}
          >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-[clamp(1rem,6cqw,2rem)]">
              {/* Left column: the name, the price, the passage limit and the two permissions. */}
              <div className="flex flex-col gap-4">
              <span className="block text-[clamp(1.25rem,7cqw,2rem)] font-bold leading-none text-primary/70">{name}</span>
              <div className="flex flex-col justify-between gap-6">
                <div className="flex flex-col items-start text-left">
                  <Input
                    id={`${key}-price`}
                    aria-label={t('adminPlans.field', { label: t('adminPlans.monthlyPrice'), name })}
                    type="number"
                    min={0}
                    step={1}
                    className={`${bareInput} w-full !text-left text-[clamp(1.75rem,11cqw,3rem)] font-black leading-none text-primary`}
                    {...register(`${key}.priceVnd`, { valueAsNumber: true })}
                  />
                  <span className="block text-sm text-muted-foreground">{t('adminPlans.perMonth')}</span>
                  {errors[key]?.priceVnd && <p className="text-sm text-destructive">{errors[key]?.priceVnd?.message}</p>}
                </div>
                <div className="space-y-3">
                <div className="flex min-h-9 items-center justify-between gap-4">
                  <HelpLabel
                    htmlFor={`${key}-max`}
                    text={t('adminPlans.passageLimit')}
                    help={t('plan.passageHelp')}
                    className={optionLabel}
                  />
                  <div className="flex flex-col items-end text-right">
                    <Input
                      id={`${key}-max`}
                      aria-label={t('adminPlans.field', { label: t('adminPlans.passageLimit'), name })}
                      type="number"
                      min={0}
                      step={1}
                      className={`${bareInput} w-24 h-9 text-[clamp(1.25rem,6cqw,1.875rem)] font-black leading-none text-primary`}
                      {...register(`${key}.maxPassages`, { valueAsNumber: true })}
                    />
                    {errors[key]?.maxPassages && <p className="text-sm text-destructive">{errors[key]?.maxPassages?.message}</p>}
                  </div>
                </div>
                {PERMISSIONS.map(({ field, labelKey, helpKey }) => (
                  <div key={field} className="flex min-h-9 items-center justify-between gap-4">
                    <HelpLabel htmlFor={`${key}-${field}`} text={t(labelKey)} help={t(helpKey)} className={optionLabel} />
                    <Controller
                      control={control}
                      name={`${key}.${field}`}
                      render={({ field: control }) => (
                        <Switch id={`${key}-${field}`} aria-label={t('adminPlans.field', { label: t(labelKey), name })} checked={control.value} onCheckedChange={control.onChange} />
                      )}
                    />
                  </div>
                ))}
                </div>
              </div>
              </div>
              {/* Right column: the avatar of the plan, as tall as the left column (from the name to the last permission). */}
              <FitAvatar look={PLAN_AVATARS[key]} label={t('plan.avatarOf', { name })} />
              </div>
            </fieldset>
          ))}
        </div>
  
        <ConfirmDialog
          open={pending !== undefined}
          onOpenChange={(open) => !open && setPending(undefined)}
          title={t('adminPlans.confirm.title')}
          description={t('adminPlans.confirm.text', {
            users: t('adminPlans.confirm.users', { count: users }),
            passages: t('adminPlans.confirm.passages', { count: passages }),
          })}
          confirmLabel={t('adminPlans.save')}
          pending={save.isPending}
          onConfirm={() => pending && saveValues(pending.values)}
        />
      </form>
    </Panel>
  );
};

/**
 * The plans page (US11.1) in panels without padding, border or background: first a line chart of the users on each plan, then the cards of the Free and Premium plans (under the title Plans, with Save on its row; two columns that share the whole width) (price, passage limit and the
 * two permissions; saving first warns how many users would lose access to passages), and, one at a time with the cards, the list of every plan change of every user: a button next to the title of each shows the other (`?show=list`, the cards first); the chart stays above both.
 */
export const AdminPlansPage = () => {
  const { t } = useTranslation('store');
  const plans = useAdminPlans();
  // The lines of the users chart: a click on a plan card picks its line (a second click, or the Lines button, brings both back).
  const [lines, setLines] = useState<PlanLines>('all');
  // The cards and the subscription list share the place under the chart, one at a time, the cards first.
  const [params, setParams] = useSearchParams();
  const showList = params.get('show') === 'list';
  const setShowList = (show: boolean) =>
    setParams(
      (next) => {
        if (show) next.set('show', 'list');
        else next.delete('show');
        return next;
      },
      { replace: true },
    );

  return (
    // The chart takes the height the panel under it leaves, so both fit the screen (the screen minus the 61px header and the 2rem padding of the page above and below).
    <div className="flex min-h-[calc(100svh-61px-4rem)] flex-col gap-8">
      <PlanUsersChart lines={lines} onLinesChange={setLines} />
      {/* The cards stay mounted (hidden) while the list is shown, so unsaved changes are not lost. */}
      <div className={showList ? 'hidden' : 'space-y-3'}>
        {plans.data ? (
          <PlansForm plans={plans.data} lines={lines} onPickLine={(line) => setLines(lines === line ? 'all' : line)} onSwitch={() => setShowList(true)} />
        ) : (
          <Panel title={t('adminPlans.title')} titleAction={<PanelTitleSwitch other={t('adminPlans.list.title')} onClick={() => setShowList(true)} />} bare titleClassName={sectionTitleClass}>
            {plans.isPending && <LoadingState rows={3} />}
            {plans.isError && <ErrorState error={plans.error} onRetry={() => void plans.refetch()} />}
          </Panel>
        )}
      </div>
      {showList && <SubscriptionList onSwitch={() => setShowList(false)} />}
    </div>
  );
};
