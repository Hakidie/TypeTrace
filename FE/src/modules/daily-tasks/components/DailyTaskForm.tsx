import { zodResolver } from "@hookform/resolvers/zod";
import {
  CircleCheck,
  CircleOff,
  Coins,
  Crosshair,
  Loader2,
  Plus,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { Textarea } from "@/shared/components/ui/textarea";
import { cn } from "@/shared/lib/utils";
import {
  DAILY_TASK_COINS_MAX,
  DAILY_TASK_TYPE_INFO,
  goalOf,
} from "../daily-tasks.config";
import {
  useCreateDailyTask,
  useUpdateDailyTask,
} from "../hooks/use-daily-tasks";
import { DAILY_TASK_TYPES, type DailyTask } from "../types/daily-task.types";

// Mirrors `createDailyTaskSchema` in BE/src/validators/admin-daily-task.validator.ts, plus the largest target of each
// type, which the backend model checks.
const schema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title is required")
      .max(120, "Max 120 characters"),
    description: z.string().trim().max(300, "Max 300 characters"),
    type: z.enum(DAILY_TASK_TYPES),
    // An empty number field gives NaN, which is not a number for Zod.
    target: z
      .number({ error: "Enter a number" })
      .int("Use a whole number")
      .min(1, "At least 1"),
    // The reward for completing it (SCRUM-301); 0 = none.
    coins: z
      .number({ error: "Enter a number" })
      .int("Use a whole number")
      .min(0, "At least 0")
      .max(DAILY_TASK_COINS_MAX, `At most ${DAILY_TASK_COINS_MAX}`),
    isActive: z.boolean(),
  })
  .superRefine(({ type, target }, context) => {
    const { max } = DAILY_TASK_TYPE_INFO[type];
    if (target > max)
      context.addIssue({
        code: "custom",
        path: ["target"],
        message: `At most ${max} for this type`,
      });
  });

type FormValues = z.infer<typeof schema>;

const emptyValues: FormValues = {
  title: "",
  description: "",
  type: "sessions",
  target: 1,
  coins: 0,
  isActive: true,
};

/** The most digits the target field takes. */
const TARGET_DIGITS = 2;

// The look of the passage forms (`OwnPassageForm`): no borders, the title big in the theme red on the left, as wide as
// its text, and the description in large text under it.
const fieldClass = "border-0 px-0 text-[1.125rem] focus-visible:ring-0";
const titleClass =
  "field-sizing-content h-12 w-auto min-w-24 max-w-full bg-transparent px-0 py-1.5 text-[1.5rem] text-primary placeholder:text-primary";
// One part of the strip of the goal, like a part of a `ListToolbar`: a 2px line in the page color before each but the
// first, a muted label and the value in the theme red.
const partClass = "inline-flex items-center gap-2 px-3 py-1.5 text-[1.125rem]";
// As wide as the value shown (`field-sizing-content`). The number field has no spin arrows: the target is typed.
const controlClass =
  "field-sizing-content h-8 bg-transparent font-normal text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

/** A picker of the strip that has no menu: a click goes to the next option and, after the last, back to the first. */
const CycleButton = <T extends string>({
  label,
  value,
  options,
  onChange,
  icon: Icon,
}: {
  label: string;
  icon?: LucideIcon;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) => {
  const index = Math.max(0, options.findIndex((option) => option.value === value));
  const next = options[(index + 1) % options.length];
  return (
    <button
      type="button"
      aria-label={`${label}: ${options[index].label}`}
      title={`Click to change to ${next.label}`}
      onClick={() => onChange(next.value)}
      className="inline-flex h-9 items-center gap-2 bg-transparent px-0 py-1.5 text-[1.125rem] font-normal text-primary transition-colors hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {Icon && <Icon className="size-5 shrink-0" aria-hidden="true" />}
      {options[index].label}
    </button>
  );
};

const TYPE_OPTIONS = DAILY_TASK_TYPES.map((value) => ({ value, label: DAILY_TASK_TYPE_INFO[value].label }));
const ACTIVE_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
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
  /** On the right of the title row (the page's Tasks per day menu). */
  titleAction?: ReactNode;
}

/**
 * The top panel of the daily tasks page, built like the passage forms: the title, the description,
 * then, in one row, the goal in words on the left, the type, the target, the coins and the Active button in the middle (Type and Active have no menu: a click shows the next value, round and round), and Cancel and Add task on the right.
 * With `task` it edits that task (Update task and Cancel); remount it (`key`) to switch task.
 */
export const DailyTaskForm = ({ task, onDone, titleAction }: DailyTaskFormProps) => {
  const createTask = useCreateDailyTask();
  const updateTask = useUpdateDailyTask();
  const saving = createTask.isPending || updateTask.isPending;

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: task
      ? {
          title: task.title,
          description: task.description,
          type: task.type,
          target: task.target,
          coins: task.coins,
          isActive: task.isActive,
        }
      : emptyValues,
  });
  const [type, target, coins] = useWatch({
    control,
    name: ["type", "target", "coins"],
  });
  const { max } = DAILY_TASK_TYPE_INFO[type];
  // What learners will be asked, while the target fits the type.
  const goal =
    Number.isInteger(target) && target >= 1 && target <= max
      ? goalOf({ type, target })
      : "";

  const targetField = register("target", { valueAsNumber: true });
  const coinsField = register("coins", { valueAsNumber: true });

  const submit = handleSubmit((input) => {
    if (task) updateTask.mutate({ id: task._id, input }, { onSuccess: onDone });
    else createTask.mutate(input, { onSuccess: () => reset(emptyValues) });
  });

  return (
    // `noValidate`: the schema checks the number field, with its own messages.
    <form
      className="flex min-h-0 flex-1 flex-col gap-4"
      aria-label={task ? "Edit task" : "New task"}
      noValidate
      onSubmit={submit}
    >
      {/* PANEL Title row: the title on the left, the page's Tasks per day menu on the right. Type, Target, Coins and Active are in the bottom row, with Add task. */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 max-w-full space-y-2">
          <Input
            className={cn(fieldClass, titleClass)}
            aria-label="Title"
            placeholder="Title of The Task"
            {...register("title")}
          />
          <FieldError message={errors.title?.message} />
        </div>
        {titleAction}
      </div>

      {/* PANEL Description. */}
      {/* The text area takes the height left on the screen (12rem at least), like the text of a passage. */}
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <Textarea
          className={cn(
            fieldClass,
            "min-h-48 flex-1 resize-none text-[2rem] leading-snug",
          )}
          aria-label="Description"
          placeholder="Describe the task for learners (optional)…"
          {...register("description")}
        />
        <FieldError message={errors.description?.message} />
      </div>

      {/* PANEL Bottom row, like the passage form: The goal in words on the left, Type, Target, Coins and Active in the middle, Cancel and Add task on the right. */}
      <div className="flex flex-col gap-4 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            {/* The goal in words, in the look of the word count of a passage. */}
            <p className="w-fit bg-transparent px-0 py-1.5 text-[1.125rem] text-primary">
              {goal}
            </p>
          </div>
          <FieldError message={errors.target?.message} />
          <FieldError message={errors.coins?.message} />
        </div>

        {/* In the middle: Type, Target, Coins and Active (centered, no background or border). */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <CycleButton label="Type"
                icon={DAILY_TASK_TYPE_INFO[field.value].icon}
                value={field.value}
                options={TYPE_OPTIONS}
                onChange={field.onChange} />
            )}
          />
          <div className={cn(partClass, "h-9 px-0")}>
            <Crosshair
              className="size-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <label htmlFor="daily-task-target" className="text-primary">
              Target
            </label>
            {/* The range is a tooltip, not text beside the field. */}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Input
                    id="daily-task-target"
                    className={cn(
                      controlClass,
                      "field-sizing-fixed h-auto min-w-[1ch] border-0 bg-transparent p-0 text-left text-[1.125rem] font-normal transition-[width] duration-150 focus-visible:ring-0",
                    )}
                    type="number"
                    // Grows and shrinks with the digits typed (an empty field keeps one digit of room).
                    style={{
                      width: `${Number.isInteger(target) ? String(target).length : 1}ch`,
                    }}
                    inputMode="numeric"
                    min={1}
                    max={max}
                    step={1}
                    {...targetField}
                    // At most 2 digits: a longer entry is cut as it is typed (`maxLength` does not work on a number field).
                    onChange={(event) => {
                      event.target.value = event.target.value
                        .replace(/\D/g, "")
                        .slice(0, TARGET_DIGITS);
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
          {/* The reward: whole coins, 0 = none; in the look of Target, just before Active. */}
          <div className={cn(partClass, "h-9 px-0")}>
            <Coins
              className="size-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <label htmlFor="daily-task-coins" className="text-primary">
              Coins
            </label>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Input
                    id="daily-task-coins"
                    className={cn(
                      controlClass,
                      "field-sizing-fixed h-auto min-w-[1ch] border-0 bg-transparent p-0 text-left text-[1.125rem] font-normal transition-[width] duration-150 focus-visible:ring-0",
                    )}
                    type="number"
                    // Grows and shrinks with the digits typed (an empty field keeps one digit of room).
                    style={{
                      width: `${Number.isInteger(coins) ? String(coins).length : 1}ch`,
                    }}
                    inputMode="numeric"
                    min={0}
                    max={DAILY_TASK_COINS_MAX}
                    step={1}
                    {...coinsField}
                    // At most 3 digits (100): a longer entry is cut as it is typed.
                    onChange={(event) => {
                      event.target.value = event.target.value
                        .replace(/\D/g, "")
                        .slice(0, 3);
                      return coinsField.onChange(event);
                    }}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  {0}–{DAILY_TASK_COINS_MAX}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <CycleButton label="Active"
                icon={field.value ? CircleCheck : CircleOff}
                value={field.value ? "active" : "inactive"}
                options={ACTIVE_OPTIONS}
                onChange={(value) => field.onChange(value === "active")} />
            )}
          />
        </div>

        <div className="flex items-center justify-end gap-4">
          {task && (
            <Button type="button" variant="outline" onClick={onDone}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={saving}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              !task && <Plus className="size-4" aria-hidden />
            )}
            {task ? "Update task" : "Add task"}
          </Button>
        </div>
      </div>
    </form>
  );
};
