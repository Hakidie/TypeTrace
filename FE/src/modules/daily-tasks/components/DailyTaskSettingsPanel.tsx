import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { Panel } from '@/shared/components/panel';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { panelBodyClass, panelTitleClass } from '@/shared/lib/panel-styles';
import { MAX_DAILY_TASK_COUNT } from '../daily-tasks.config';
import { useActiveDailyTaskCount, useDailyTaskSettings, useUpdateDailyTaskSettings } from '../hooks/use-daily-tasks';

// Mirrors `dailyTaskSettingsSchema` in BE/src/validators/admin-daily-task.validator.ts.
const schema = z.object({
  dailyTaskCount: z
    .number({ error: 'Enter a number' })
    .int('Use a whole number')
    .min(1, 'At least 1')
    .max(MAX_DAILY_TASK_COUNT, `At most ${MAX_DAILY_TASK_COUNT}`),
});

type FormValues = z.infer<typeof schema>;

/** What `count` tasks a day means with the `active` tasks there are (unknown while they load). */
const hintOf = (count: number, active?: number) => {
  if (active === undefined) return 'How many of the active tasks each learner gets every day.';
  if (active === 0) return 'No task is active yet: learners get none until one is.';
  if (active < count) return `Only ${active} active ${active === 1 ? 'task' : 'tasks'}: learners get ${active} a day until more are active.`;
  if (active === count) return active === 1 ? 'Each learner gets the one active task every day.' : `Each learner gets all ${active} active tasks every day.`;
  return `Each learner gets ${count} of the ${active} active tasks every day.`;
};

/** The number field and its Save button. Mounted again (`key`) when a new count is saved, so it starts from that one. */
const TaskCountForm = ({ saved }: { saved: number }) => {
  const active = useActiveDailyTaskCount();
  const save = useUpdateDailyTaskSettings();
  const { register, control, handleSubmit, formState: { errors, isDirty } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { dailyTaskCount: saved },
  });
  const typed = useWatch({ control, name: 'dailyTaskCount' });
  // The hint follows the field while it holds a count that may be saved.
  const count = schema.safeParse({ dailyTaskCount: typed }).success ? typed : saved;
  const error = errors.dailyTaskCount?.message;

  return (
    <form className="space-y-2" noValidate onSubmit={handleSubmit((settings) => save.mutate(settings))}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Label htmlFor="daily-task-count" className="text-xl font-medium">
            Tasks per day
          </Label>
          <p className="text-lg text-muted-foreground">{hintOf(count, active.data)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Input
            id="daily-task-count"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_DAILY_TASK_COUNT}
            step={1}
            className="w-24"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'daily-task-count-error' : undefined}
            {...register('dailyTaskCount', { valueAsNumber: true })}
          />
          <Button type="submit" disabled={!isDirty || save.isPending}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            Save
          </Button>
        </div>
      </div>
      {error && (
        <p id="daily-task-count-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
};

/** The Settings panel of the daily tasks page: how many of the active tasks each learner gets a day (an app setting). */
export const DailyTaskSettingsPanel = () => {
  const settings = useDailyTaskSettings();

  const renderBody = () => {
    if (settings.isPending) return <LoadingState rows={1} />;
    if (settings.isError) return <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />;
    return <TaskCountForm key={settings.data.dailyTaskCount} saved={settings.data.dailyTaskCount} />;
  };

  return (
    <Panel title="Settings" bare titleClassName={panelTitleClass} className={panelBodyClass}>
      {renderBody()}
    </Panel>
  );
};
