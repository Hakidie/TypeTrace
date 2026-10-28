import { CircleCheck } from 'lucide-react';
import { DAILY_TASK_TYPE_INFO, goalOf } from '@/modules/daily-tasks/daily-tasks.config';
import { getApiErrorMessage } from '@/shared/api/api-error';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { useDailyTasks } from '../hooks/use-profile';
import type { DailyTaskProgress } from '../types/profile.types';

const linkClass = 'text-primary underline-offset-4 hover:underline';
// One column on phones, two from `md`, three from `lg`. `grid-cols-1` keeps the phone column at the width of the screen
// (`minmax(0, 1fr)`): without it the column grows to the longest title, which then runs off the screen uncut.
const gridClass = 'grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2 lg:grid-cols-3';
// Blank tasks while they load: a row of them on wide screens.
const BLANK_TASKS = 3;

/** How far a task is, in the unit of its target: "2 / 3 sessions", "12.5 / 15 min", "38.5 / 40 WPM", "85.5% / 90%". */
const numbersOf = ({ type, progress, target }: DailyTaskProgress) => {
  switch (type) {
    case 'sessions':
      return `${progress} / ${target} ${target === 1 ? 'session' : 'sessions'}`;
    case 'minutes':
      return `${progress} / ${target} min`;
    case 'wpm':
      return `${progress} / ${target} WPM`;
    case 'accuracy':
      return `${progress}% / ${target}%`;
  }
};

/**
 * One task: the icon of its type, the title (on one line, cut with an ellipsis; the whole title is its tooltip), the goal
 * in words (`goalOf`, with the focus error of an accuracy task) and the description, then the bar and the numbers, pushed
 * to the bottom so the bars of a row line up. A done task has a full bar and a Done mark; the numbers keep what was
 * reached, which can be more than the target.
 */
const DailyTaskItem = ({ task }: { task: DailyTaskProgress }) => {
  const { icon: Icon } = DAILY_TASK_TYPE_INFO[task.type];
  const numbers = numbersOf(task);
  const filled = task.completed ? 100 : Math.min(task.progress / task.target, 1) * 100;

  return (
    <li className="flex flex-col gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center bg-primary/25 text-primary" aria-hidden>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xl font-extrabold text-primary/80" title={task.title}>{task.title}</p>
          <p className="text-base text-muted-foreground">{goalOf(task)}</p>
          {task.description && <p className="line-clamp-2 text-sm text-muted-foreground">{task.description}</p>}
        </div>
      </div>
      <div className="mt-auto space-y-2">
        <div
          role="progressbar"
          aria-label={task.title}
          aria-valuemin={0}
          aria-valuemax={task.target}
          aria-valuenow={Math.min(task.progress, task.target)}
          aria-valuetext={numbers}
          className="h-2 bg-muted"
        >
          <div className="h-full bg-primary" style={{ width: `${filled}%` }} />
        </div>
        <div className="flex items-baseline justify-between gap-3 text-base">
          <span className="text-muted-foreground">{numbers}</span>
          {task.completed && (
            <span className="text-primary">
              <CircleCheck className="mr-1.5 inline size-4 align-text-bottom" aria-hidden />
              Done
            </span>
          )}
        </div>
      </div>
    </li>
  );
};

/**
 * The learner's tasks of today (SCRUM-112), under the heatmap and without a frame: the DAILY TASKS label in the look of
 * the TODAY one, then one item per task, in the order the backend gives them. Only today's counted sessions count, in
 * the learner's time zone (the backend measures them). While the tasks load, blank tasks hold their place so the
 * sessions under them do not jump; when they fail, the reason and a retry on one line, like `TodayProgress`; a day
 * without tasks (no task is active) is one muted line.
 */
export const ProfileDailyTasks = () => {
  const dailyTasks = useDailyTasks();

  const renderBody = () => {
    if (dailyTasks.isPending) {
      return (
        <div className={gridClass}>
          {Array.from({ length: BLANK_TASKS }, (_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
      );
    }
    if (dailyTasks.isError) {
      return (
        <p role="alert" className="text-base text-muted-foreground">
          <span className="text-destructive">Daily tasks could not load.</span> {getApiErrorMessage(dailyTasks.error, 'Please try again.')} ·{' '}
          <button type="button" onClick={() => void dailyTasks.refetch()} className={linkClass}>
            Try again
          </button>
        </p>
      );
    }
    if (dailyTasks.data.tasks.length === 0) return <p className="text-base text-muted-foreground">No daily tasks today.</p>;
    return (
      <ul className={gridClass}>
        {dailyTasks.data.tasks.map((task) => (
          <DailyTaskItem key={task.id} task={task} />
        ))}
      </ul>
    );
  };

  return (
    <section aria-label="Daily tasks" aria-busy={dailyTasks.isPending} className="space-y-4">
      <p className="text-base font-semibold leading-none tracking-widest text-primary/70">DAILY TASKS</p>
      {renderBody()}
    </section>
  );
};
