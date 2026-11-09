import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useState } from 'react';
import { z } from 'zod';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { ErrorState } from '@/shared/components/error-state';
import { FormField } from '@/shared/components/form-field';
import { LoadingState } from '@/shared/components/loading-state';
import { Panel } from '@/shared/components/panel';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import { useAdminPlans, usePreviewPlans, useSavePlans } from '../hooks/use-admin-plans';
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

const PLANS = [
  { key: 'free', name: 'Free' },
  { key: 'premium', name: 'Premium' },
] as const;

const PlansForm = ({ plans }: { plans: PlansConfig }) => {
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

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <div className="grid gap-6 md:grid-cols-2">
        {PLANS.map(({ key, name }) => (
          <fieldset key={key} className="space-y-4 border border-border p-4">
            <legend className="px-2 text-xl font-bold text-primary">{`Gói ${name}`}</legend>
            <FormField id={`${key}-price`} label={`Giá theo tháng (${name})`} error={errors[key]?.priceVnd?.message} hint="VND">
              <Input id={`${key}-price`} type="number" min={0} step={1} {...register(`${key}.priceVnd`, { valueAsNumber: true })} />
            </FormField>
            <FormField id={`${key}-max`} label={`Hạn mức passage (${name})`} error={errors[key]?.maxPassages?.message}>
              <Input id={`${key}-max`} type="number" min={0} step={1} {...register(`${key}.maxPassages`, { valueAsNumber: true })} />
            </FormField>
            {(
              [
                ['canCreateErrorPractice', 'Tạo bài luyện theo lỗi'],
                ['canUsePublicPassages', 'Luyện passage công khai của người khác'],
              ] as const
            ).map(([field, label]) => (
              <div key={field} className="flex items-center justify-between gap-4">
                <Label htmlFor={`${key}-${field}`}>{label}</Label>
                <Controller
                  control={control}
                  name={`${key}.${field}`}
                  render={({ field: control }) => (
                    <Switch id={`${key}-${field}`} aria-label={`${label} (${name})`} checked={control.value} onCheckedChange={control.onChange} />
                  )}
                />
              </div>
            ))}
          </fieldset>
        ))}
      </div>
      <Button type="submit" disabled={preview.isPending || save.isPending}>
        Lưu
      </Button>

      <ConfirmDialog
        open={pending !== undefined}
        onOpenChange={(open) => !open && setPending(undefined)}
        title="Lưu thay đổi?"
        description={`${pending?.lock.lockedUsers ?? 0} user sẽ bị khóa passage (${pending?.lock.lockedPassages ?? 0} passage). Dữ liệu không mất: passage mở lại khi họ mua Premium hoặc khi bạn tăng hạn mức.`}
        confirmLabel="Lưu"
        pending={save.isPending}
        onConfirm={() => pending && saveValues(pending.values)}
      />
    </form>
  );
};

/** The Free and Premium plans: price, passage limit and the two permissions (US11.1). Saving first warns how many users would lose access to passages. */
export const AdminPlansPage = () => {
  const plans = useAdminPlans();

  return (
    <Panel title="Gói Free và Premium" description="Giá, hạn mức passage và quyền của từng gói.">
      {plans.isPending && <LoadingState rows={3} />}
      {plans.isError && <ErrorState error={plans.error} onRetry={() => void plans.refetch()} />}
      {plans.data && <PlansForm plans={plans.data} />}
    </Panel>
  );
};
