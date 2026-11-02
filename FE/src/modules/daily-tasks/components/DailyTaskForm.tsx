import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { errorLabels } from '@/modules/typing/typing.config';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import { Textarea } from '@/shared/components/ui/textarea';
import { cn } from '@/shared/lib/utils';
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

// The look of the passage forms (`OwnPassageForm`): no borders, the title big in the theme red on the left, as wide as
// its text, and the description in large text under it.
const fieldClass = 'border-0 text-[1.125rem] focus-visible:ring-0';
const titleClass = 'field-sizing-content h-12 w-auto min-w-24 max-w-full bg-transparent px-3 py-1.5 text-[1.5rem] text-primary placeholder:text-primary';
// One part of the strip of the goal, like a part of a `ListToolbar`: a 2px line in the page color before each but the
// first, a muted label and the value in the theme red.
const partClass = 'inline-flex h-10 items-center gap-2 border-l-2 border-background px-3 text-base first:border-l-0';
// As wide as the value shown (`field-sizing-content`), not as the longest option.
const controlClass =
  'field-sizing-content h-8 bg-transparent font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_option]:bg-background [&_option]:text-foreground';

/** No visible labels on the text fields: the placeholders say what each is, `aria-label` serves screen readers. */
const FieldError = ({ message }: { message?: string }) =>
  message ? (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  ) : null;

interface DailyTaskFormProps {
  /** The task to edit. Without it the form adds a new task. */
  task?: DailyTask;
  /** Edit mode: called after a successful update and by the Cancel button. */
  onDone?: () => void;
}

/**
 * The top panel of the daily tasks page, built like the passage forms: the title and the Active switch, the description,
 * then a strip with the type, the target and (accuracy only) the focus error, the goal in words next to it, and Add task.
 * With `task` it edits that task (Update task and Cancel); remount it (`key`) to switch task.
 */
export const DailyTaskForm = ({ task, onDone }: DailyTaskFormProps) => {
  const createTask = useCreateDailyTask();
  const updateTask = useUpdateDailyTask();
  const saving = createTask.isPending || updateTask.isPending;

  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
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
  // What learners will be asked, while the target fits the type.
  const goal = Number.isInteger(target) && target >= 1 && target <= max ? goalOf({ type, target, errorType: errorType || null }) : '';

  const submit = handleSubmit((values) => {
    // Only an accuracy task may have a focus. The form keeps the one picked while another type is chosen (switching back
    // finds it) but sends `null` then, which also takes away the focus of a task that was an accuracy task.
    const input = { ...values, errorType: values.type === 'accuracy' && values.errorType ? values.errorType : null };
    if (task) updateTask.mutate({ id: task._id, input }, { onSuccess: onDone });
    else createTask.mutate(input, { onSuccess: () => reset(emptyValues) });
  });

  return (
    // `noValidate`: the schema checks the number field, with its own messages.
    <form className="flex flex-col gap-4" aria-label={task ? 'Edit task' : 'New task'} noValidate onSubmit={submit}>
      <div className="flex flex-col gap-4 md:flex-row md:justify-between">
        <div className="min-w-0 max-w-full space-y-2 md:max-w-[calc(100%-10rem)]">
          <Input className={cn(fieldClass, titleClass)} aria-label="Title" placeholder="Title of The Task" {...register('title')} />
          <FieldError message={errors.title?.message} />
        </div>
        {/* On the right like the Source of a passage, also when the two are stacked on a phone. */}
        <Controller
          control={control}
          name="isActive"
          render={({ field }) => (
            <div className="ml-auto flex h-12 items-center gap-3 px-3">
              <Label htmlFor="daily-task-active" className="text-[1.5rem] font-normal text-primary">
                Active
              </Label>
              <Switch id="daily-task-active" checked={field.value} onCheckedChange={field.onChange} />
            </div>
          )}
        />
      </div>

      <div className="space-y-2">
        <Textarea
          className={cn(fieldClass, 'min-h-32 resize-none text-[2rem] leading-snug')}
          aria-label="Description"
          placeholder="Describe the task for learners (optional)…"
          {...register('description')}
        />
        <FieldError message={errors.description?.message} />
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex w-fit flex-wrap bg-primary/15">
              <div className={partClass}>
                <label htmlFor="daily-task-type" className="text-muted-foreground">
                  Type
                </label>
                <select id="daily-task-type" className={controlClass} {...register('type')}>
                  {DAILY_TASK_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {DAILY_TASK_TYPE_INFO[value].label}
                    </option>
                  ))}
                </select>
              </div>
              <div className={partClass}>
                <label htmlFor="daily-task-target" className="text-muted-foreground">
                  Target
                </label>
                <Input
                  id="daily-task-target"
                  className={cn(controlClass, 'w-auto min-w-10 border-0 px-1 text-center text-base focus-visible:ring-0')}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={max}
                  step={1}
                  aria-describedby="daily-task-target-range"
                  {...register('target', { valueAsNumber: true })}
                />
                <span id="daily-task-target-range" className="text-sm text-muted-foreground">
                  (1–{max})
                </span>
              </div>
              {/* Only an accuracy task can focus on one error type. */}
              {type === 'accuracy' && (
                <div className={partClass}>
                  <label htmlFor="daily-task-focus" className="text-muted-foreground">
                    Focus
                  </label>
                  <select id="daily-task-focus" className={controlClass} {...register('errorType')}>
                    <option value="">None</option>
                    {ERROR_TYPES.map((value) => (
                      <option key={value} value={value}>
                        {errorLabels[value]}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            {/* The goal in words, in the look of the word count of a passage. */}
            <p className="px-3 py-1.5 text-[1.125rem] text-primary">{goal}</p>
          </div>
          <FieldError message={errors.target?.message} />
        </div>

        <div className="flex items-center justify-end gap-4">
          {task && (
            <Button type="button" variant="outline" onClick={onDone}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {task ? 'Update task' : 'Add task'}
          </Button>
        </div>
      </div>
    </form>
  );
};
