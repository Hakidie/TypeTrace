import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { usePlacementSettings, useUpdatePlacementSettings } from '../hooks/use-ranked';
import { MAX_PLACEMENT_MIN_ACCURACY, MIN_PLACEMENT_MIN_ACCURACY } from '../lib/placement-board';

// Mirrors `placementSettingsSchema` in BE/src/validators/placement.validator.ts. An empty number field gives NaN, which is not a number for Zod.
const schema = z.object({
  minAccuracy: z
    .number({ error: 'Enter a number' })
    .int('Use a whole number')
    .min(MIN_PLACEMENT_MIN_ACCURACY, `At least ${MIN_PLACEMENT_MIN_ACCURACY}`)
    .max(MAX_PLACEMENT_MIN_ACCURACY, `At most ${MAX_PLACEMENT_MIN_ACCURACY}`),
});

type FormValues = z.infer<typeof schema>;

/**
 * The admin setting of the placement leaderboard (US10.1), in the admin Settings page: the accuracy a 3-minute placement session needs
 * to be on it. It applies to sessions completed after it is saved.
 */
export const PlacementMinAccuracySetting = () => {
  const settings = usePlacementSettings();
  const save = useUpdatePlacementSettings();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { minAccuracy: 90 } });

  // The form shows the saved value once it arrives, and again after a save (so it is not dirty any more).
  useEffect(() => {
    if (settings.data) reset({ minAccuracy: settings.data.minAccuracy });
  }, [settings.data, reset]);

  if (settings.isPending) return <LoadingState rows={1} />;
  if (settings.isError) return <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />;

  return (
    <form onSubmit={handleSubmit((values) => save.mutate(values))} noValidate className="space-y-2">
      {/* The label and the field share a row; the explanation is under them. */}
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="minAccuracy" className="text-xl font-medium">
          Minimum accuracy (%)
        </Label>
        <div className="flex shrink-0 items-center gap-2">
          <Input
            id="minAccuracy"
            type="number"
            inputMode="numeric"
            className="w-24 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            aria-invalid={!!errors.minAccuracy}
            aria-describedby={errors.minAccuracy ? 'minAccuracy-error' : undefined}
            {...register('minAccuracy', { valueAsNumber: true })}
          />
          <Button type="submit" disabled={!isDirty || save.isPending}>
            Save
          </Button>
        </div>
      </div>
      <p className="text-lg text-muted-foreground">Lowest accuracy for a 3-minute placement session to be on the leaderboard. Saving it updates the board.</p>
      {errors.minAccuracy && (
        <p id="minAccuracy-error" role="alert" className="text-sm text-destructive">
          {errors.minAccuracy.message}
        </p>
      )}
    </form>
  );
};
