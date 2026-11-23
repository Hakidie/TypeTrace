import { zodResolver } from '@hookform/resolvers/zod';
import type { TFunction } from 'i18next';
import { useEffect, useMemo } from 'react';
import { type FieldError, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { useAiSettings, useUpdateAiSettings } from '../hooks/use-ai-settings';
import {
  DEFAULT_AI_LESSONS_PER_DAY,
  DEFAULT_AI_LESSONS_PER_MINUTE,
  MAX_AI_LESSONS_PER_DAY,
  MAX_AI_LESSONS_PER_MINUTE,
  MIN_AI_LESSONS_PER_MINUTE,
} from '../lib/ai-settings';

// Mirrors `aiSettingsSchema` in BE/src/validators/admin-ai-setting.validator.ts. An empty number field gives NaN, which is not a number for Zod.
const schemaOf = (t: TFunction<'settings'>) => {
  const whole = (min: number, max: number) =>
    z
      .number({ error: t('aiSettings.enterNumber') })
      .int(t('aiSettings.wholeNumber'))
      .min(min, t('aiSettings.atLeast', { min }))
      .max(max, t('aiSettings.atMost', { max }));
  return z.object({
    lessonsPerDay: whole(0, MAX_AI_LESSONS_PER_DAY),
    lessonsPerMinute: whole(MIN_AI_LESSONS_PER_MINUTE, MAX_AI_LESSONS_PER_MINUTE),
  });
};

type FormValues = z.infer<ReturnType<typeof schemaOf>>;

/** A label, a number field and its error on one row. */
const NumberRow = ({ id, label, error, field }: { id: string; label: string; error?: FieldError; field: object }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between gap-4">
      <Label htmlFor={id} className="text-xl font-medium">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        className="w-24 shrink-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        {...field}
      />
    </div>
    {error && (
      <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
        {error.message}
      </p>
    )}
  </div>
);

/**
 * The admin setting of the AI cost (SCRUM-153), in the admin Settings page: how many passages the AI may write for one
 * learner in Weak spots, a day and a minute. Past a limit, a lesson types a passage saved before (the day's limit only), or
 * its words; 0 a day turns the AI off.
 */
export const AiLessonLimitSetting = () => {
  const { t } = useTranslation('settings');
  const schema = useMemo(() => schemaOf(t), [t]);
  const settings = useAiSettings();
  const save = useUpdateAiSettings();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { lessonsPerDay: DEFAULT_AI_LESSONS_PER_DAY, lessonsPerMinute: DEFAULT_AI_LESSONS_PER_MINUTE },
  });

  // The form shows the saved values once they arrive, and again after a save (so it is not dirty any more).
  useEffect(() => {
    if (settings.data) reset(settings.data);
  }, [settings.data, reset]);

  if (settings.isPending) return <LoadingState rows={1} />;
  if (settings.isError) return <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />;

  return (
    <form onSubmit={handleSubmit((values) => save.mutate(values))} noValidate className="space-y-3">
      <NumberRow
        id="lessonsPerDay"
        label={t('aiSettings.lessonsPerDay')}
        error={errors.lessonsPerDay}
        field={register('lessonsPerDay', { valueAsNumber: true })}
      />
      <NumberRow
        id="lessonsPerMinute"
        label={t('aiSettings.lessonsPerMinute')}
        error={errors.lessonsPerMinute}
        field={register('lessonsPerMinute', { valueAsNumber: true })}
      />
      <div className="flex items-start justify-between gap-4">
        <p className="text-lg text-muted-foreground">{t('aiSettings.hint')}</p>
        <Button type="submit" className="shrink-0" disabled={!isDirty || save.isPending}>
          {t('aiSettings.save')}
        </Button>
      </div>
    </form>
  );
};
