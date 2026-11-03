import { zodResolver } from '@hookform/resolvers/zod';
import { CircleCheck, CircleOff, Crosshair, Loader2, Plus, type LucideIcon } from 'lucide-react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { errorLabels } from '@/modules/typing/typing.config';
import { MenuOption } from '@/shared/components/list-toolbar';
import { Button } from '@/shared/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Input } from '@/shared/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
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

/** The most digits the target field takes. */
const TARGET_DIGITS = 2;

// The look of the passage forms (`OwnPassageForm`): no borders, the title big in the theme red on the left, as wide as
// its text, and the description in large text under it.
const fieldClass = 'border-0 text-[1.125rem] focus-visible:ring-0';
const titleClass = 'field-sizing-content h-12 w-auto min-w-24 max-w-full bg-transparent px-3 py-1.5 text-[1.5rem] text-primary placeholder:text-primary';
// The Type menu button, sized like the title field (same height, padding, text size and red).
const typeClass = 'h-12 gap-2 px-0 py-1.5 text-[1.5rem] font-normal';
// One part of the strip of the goal, like a part of a `ListToolbar`: a 2px line in the page color before each but the
// first, a muted label and the value in the theme red.
const partClass = 'inline-flex items-center gap-2 px-3 py-1.5 text-[1.5rem]';
// As wide as the value shown (`field-sizing-content`). The number field has no spin arrows: the target is typed.
const controlClass =
  'field-sizing-content h-8 bg-transparent font-normal text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

/** A picker of the strip: the value on a button that opens the shared menu (the chosen option checked), not a native select. */
const StripMenu = <T extends string>({
  label,
  value,
  options,
  onChange,
  triggerClassName,
  align,
  icon: Icon,
}: {
  label: string;
  /** Drawn before the value. */
  icon?: LucideIcon;
  triggerClassName?: string;
  /** Which edge of the button the menu lines up with; `end` for a button at the right edge of the page. */
  align?: 'start' | 'end';
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) => {
  const current = options.find((option) => option.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${label}: ${current?.label}`}
        className={cn(
          'h-8 gap-1.5 px-2 font-normal text-primary transition-colors hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          triggerClassName,
        )}
      >
        {Icon && <Icon className="size-6 shrink-0" aria-hidden="true" />}
        {current?.label}
      </DropdownMenuTrigger>
      <DropdownMenuContent role="menu" aria-label={label} align={align} className="min-w-44">
        {options.map((option) => (
          <MenuOption key={option.value} selected={option.value === value} onSelect={() => onChange(option.value)}>
            {option.label}
          </MenuOption>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const TYPE_OPTIONS = DAILY_TASK_TYPES.map((value) => ({ value, label: DAILY_TASK_TYPE_INFO[value].label }));
const ACTIVE_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];
const FOCUS_OPTIONS: { value: FormValues['errorType']; label: string }[] = [
  { value: '', label: 'None' },
  ...ERROR_TYPES.map((value) => ({ value, label: errorLabels[value] })),
];

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
 * The top panel of the daily tasks page, built like the passage forms: the title, the description,
 * then a strip with the type, the target, the Active switch and (accuracy only) the focus error, the goal in words next to it, and Add task.
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

  const targetField = register('target', { valueAsNumber: true });

  const submit = handleSubmit((values) => {
    // Only an accuracy task may have a focus. The form keeps the one picked while another type is chosen (switching back
    // finds it) but sends `null` then, which also takes away the focus of a task that was an accuracy task.
    const input = { ...values, errorType: values.type === 'accuracy' && values.errorType ? values.errorType : null };
    if (task) updateTask.mutate({ id: task._id, input }, { onSuccess: onDone });
    else createTask.mutate(input, { onSuccess: () => reset(emptyValues) });
  });

  return (
    // `noValidate`: the schema checks the number field, with its own messages.
    <form className="flex min-h-0 flex-1 flex-col gap-4" aria-label={task ? 'Edit task' : 'New task'} noValidate onSubmit={submit}>
      {/* PANEL Title row: the title on the left; on the right Type, Target and Active. */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 max-w-full space-y-2">
          <Input className={cn(fieldClass, titleClass)} aria-label="Title" placeholder="Title of The Task" {...register('title')} />
          <FieldError message={errors.title?.message} />
        </div>
        {/* Top right, beside the title: the Type menu, then the target and the Active menu in the look of the title (big, in the theme red). */}
        <div className="flex flex-wrap items-center justify-end gap-x-8">
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <StripMenu
                label="Type"
                icon={DAILY_TASK_TYPE_INFO[field.value].icon}
                value={field.value}
                options={TYPE_OPTIONS}
                onChange={field.onChange}
                triggerClassName={typeClass}
                align="end"
              />
            )}
          />
        <div className={cn(partClass, 'h-12 px-0')}>
          <Crosshair className="size-6 shrink-0 text-primary" aria-hidden="true" />
          <label htmlFor="daily-task-target" className="text-primary">
            Target
          </label>
          {/* The range is a tooltip, not text beside the field. */}
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Input
                  id="daily-task-target"
                  className={cn(controlClass, 'field-sizing-fixed h-auto min-w-[1ch] border-0 bg-transparent p-0 text-left text-[1.5rem] font-normal transition-[width] duration-150 focus-visible:ring-0')}
                  type="number"
                  // Grows and shrinks with the digits typed (an empty field keeps one digit of room).
                  style={{ width: `${Number.isInteger(target) ? String(target).length : 1}ch` }}
                  inputMode="numeric"
                  min={1}
                  max={max}
                  step={1}
                  {...targetField}
                  // At most 2 digits: a longer entry is cut as it is typed (`maxLength` does not work on a number field).
                  onChange={(event) => {
                    event.target.value = event.target.value.replace(/\D/g, '').slice(0, TARGET_DIGITS);
                    return targetField.onChange(event);
                  }}
                />
              </TooltipTrigger>
              <TooltipContent>
                {1}–{max}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <StripMenu
                label="Active"
                icon={field.value ? CircleCheck : CircleOff}
                value={field.value ? 'active' : 'inactive'}
                options={ACTIVE_OPTIONS}
                onChange={(value) => field.onChange(value === 'active')}
                triggerClassName={typeClass}
                align="end"
              />
            )}
          />
        </div>
      </div>

      {/* PANEL Description. */}
      {/* The text area takes the height left on the screen (12rem at least), like the text of a passage. */}
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <Textarea
          className={cn(fieldClass, 'min-h-48 flex-1 resize-none text-[2rem] leading-snug')}
          aria-label="Description"
          placeholder="Describe the task for learners (optional)…"
          {...register('description')}
        />
        <FieldError message={errors.description?.message} />
      </div>

      {/* PANEL Bottom row: Focus and the goal in words on the left, Cancel and Add task on the right. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex w-fit flex-wrap">
              {/* Only an accuracy task can focus on one error type. */}
              {type === 'accuracy' && (
                <div className={cn(partClass, 'px-3 text-[1.125rem]')}>
                  <span className="text-primary">Focus</span>
                  <Controller control={control} name="errorType" render={({ field }) => <StripMenu label="Focus" value={field.value} options={FOCUS_OPTIONS} onChange={field.onChange} />} />
                </div>
              )}
            </div>
            {/* The goal in words, in the look of the word count of a passage. */}
            <p className="w-fit bg-transparent px-3 py-1.5 text-[1.125rem] text-primary">{goal}</p>
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
            {saving ? <Loader2 className="size-4 animate-spin" /> : !task && <Plus className="size-4" aria-hidden />}
            {task ? 'Update task' : 'Add task'}
          </Button>
        </div>
      </div>
    </form>
  );
};
