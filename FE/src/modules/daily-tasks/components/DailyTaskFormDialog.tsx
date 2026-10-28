import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { errorLabels } from '@/modules/typing/typing.config';
import { FormField } from '@/shared/components/form-field';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import { Textarea } from '@/shared/components/ui/textarea';
import { WordError } from '@/shared/lib/vietnamese-errors';
import { DAILY_TASK_TYPE_INFO, goalOf } from '../daily-tasks.config';
import { useCreateDailyTask, useUpdateDailyTask } from '../hooks/use-daily-tasks';
import { DAILY_TASK_TYPES, type DailyTask } from '../types/daily-task.types';

// Mirrors `createDailyTaskSchema` in BE/src/validators/admin-daily-task.validator.ts, plus the largest target of each
// type, which the backend model checks.
const schema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(120, 'Max 120 characters'),
    description: z.string().trim().max(300, 'Max 300 characters'),
    type: z.enum(DAILY_TASK_TYPES),
    // An empty number field gives NaN, which is not a number for Zod.
    target: z.number({ error: 'Enter a number' }).int('Use a whole number').min(1, 'At least 1'),
    // The Focus error select: '' is None. Sent as `null` then, and whenever the type is not accuracy.
    errorType: z.union([z.enum(WordError), z.literal('')]),
    isActive: z.boolean(),
  })
  .superRefine(({ type, target }, context) => {
    const { max } = DAILY_TASK_TYPE_INFO[type];
    if (target > max) context.addIssue({ code: 'custom', path: ['target'], message: `At most ${max} for this type` });
  });

type FormValues = z.infer<typeof schema>;

const emptyValues: FormValues = { title: '', description: '', type: 'sessions', target: 1, errorType: '', isActive: true };

const ERROR_TYPES = Object.values(WordError);

const selectClass =
  'h-10 w-full border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

interface DailyTaskFormDialogProps {
  /** Task to edit; without it the dialog creates a new one. */
  task?: DailyTask;
  onClose: () => void;
}

/** Create / edit form in a dialog. Mount it with `key={task?._id ?? 'new'}`. */
export const DailyTaskFormDialog = ({ task, onClose }: DailyTaskFormDialogProps) => {
  const createTask = useCreateDailyTask();
  const updateTask = useUpdateDailyTask();
  const saving = createTask.isPending || updateTask.isPending;

  const { register, control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: task
      ? {
          title: task.title,
          description: task.description,
          type: task.type,
          target: task.target,
          errorType: task.errorType ?? '',
          isActive: task.isActive,
        }
      : emptyValues,
  });
  const [type, target, errorType] = useWatch({ control, name: ['type', 'target', 'errorType'] });
  const { max } = DAILY_TASK_TYPE_INFO[type];

  const onSubmit = handleSubmit(async (values) => {
    // Only an accuracy task may have a focus. The form keeps the one picked while another type is chosen (switching back
    // finds it) but sends `null` then, which also takes away the focus of a task that was an accuracy task.
    const input = { ...values, errorType: values.type === 'accuracy' && values.errorType ? values.errorType : null };
    if (task) await updateTask.mutateAsync({ id: task._id, input });
    else await createTask.mutateAsync(input);
    onClose();
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task ? 'Edit daily task' : 'New daily task'}</DialogTitle>
          <DialogDescription>Each day, learners get some of the active tasks.</DialogDescription>
        </DialogHeader>

        {/* `noValidate`: the schema checks the number field, with its own messages. `.catch` keeps a failed request from
            becoming an unhandled rejection; the toast already explains it. */}
        <form className="space-y-4" noValidate onSubmit={(event) => void onSubmit(event).catch(() => undefined)}>
          <FormField id="daily-task-title" label="Title" error={errors.title?.message}>
            <Input id="daily-task-title" autoFocus placeholder="Warm-up" {...register('title')} />
          </FormField>

          <div className="space-y-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="daily-task-type" label="Type">
                <select id="daily-task-type" className={selectClass} {...register('type')}>
                  {DAILY_TASK_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {DAILY_TASK_TYPE_INFO[value].label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField id="daily-task-target" label="Target" hint={`1–${max}`} error={errors.target?.message}>
                <Input
                  id="daily-task-target"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={max}
                  step={1}
                  {...register('target', { valueAsNumber: true })}
                />
              </FormField>
              {/* Only an accuracy task can focus on one error type. */}
              {type === 'accuracy' && (
                <div className="sm:col-span-2">
                  <FormField id="daily-task-error-type" label="Focus error">
                    <select id="daily-task-error-type" className={selectClass} {...register('errorType')}>
                      <option value="">None</option>
                      {ERROR_TYPES.map((value) => (
                        <option key={value} value={value}>
                          {errorLabels[value]}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>
              )}
            </div>
            {/* What learners will be asked, while the target fits the type. */}
            <p className="min-h-6 text-base text-muted-foreground">
              {Number.isInteger(target) && target >= 1 && target <= max ? goalOf({ type, target, errorType: errorType || null }) : null}
            </p>
          </div>

          <FormField id="daily-task-description" label="Description" hint="Optional" error={errors.description?.message}>
            <Textarea id="daily-task-description" rows={3} {...register('description')} />
          </FormField>

          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="daily-task-active">Active</Label>
                <Switch id="daily-task-active" checked={field.value} onCheckedChange={field.onChange} />
              </div>
            )}
          />

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {task ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
