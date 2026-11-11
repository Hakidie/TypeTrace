import { CircleCheck, Coins } from 'lucide-react';
import { useState } from 'react';
import { DAILY_TASK_TYPE_INFO } from '@/modules/daily-tasks/daily-tasks.config';
import { getApiErrorMessage } from '@/shared/api/api-error';
import { Pagination } from '@/shared/components/pagination';
import { Panel } from '@/shared/components/panel';
import { PanelTitleSwitch } from '@/shared/components/panel-title-switch';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { sectionTitleClass } from '@/shared/lib/panel-styles';
import { cn } from '@/shared/lib/utils';
import { useDailyTasks } from '../hooks/use-profile';
import type { DailyTaskProgress } from '../types/profile.types';

const linkClass = 'text-primary underline-offset-4 hover:underline';
// One column on phones, two from `md`, three from `lg`. `grid-cols-1` keeps the phone column at the width of the screen
// (`minmax(0, 1fr)`): without it the column grows to the longest title, which then runs off the screen uncut.
const gridClass = 'grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2 lg:grid-cols-3';
// Blank tasks while they load: a row of them on wide screens.
const BLANK_TASKS = 3;
// Tasks on a page: one row on wide screens, the rest on the next pages.
const TASKS_PER_PAGE = 3;

/**
 * The tasks from the oldest template to the newest, left to right: the id of a template is a MongoDB ObjectId, which starts
 * with its creation time, so the ids in plain order are the templates in order of creation. The backend gives the tasks in
 * the order they were picked (weak error types first), which says nothing to the learner.
 */
const oldestFirst = (tasks: DailyTaskProgress[]) => [...tasks].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

/** How far a task is, in the unit of its target: "2 / 3 sessions", "12.5 / 15 min", "38.5 / 40 WPM", "85.5% / 90%", "1 / 3 minigames". */
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
    case 'minigames':
      return `${progress} / ${target} ${target === 1 ? 'minigame' : 'minigames'}`;
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
    <li className="group -mr-3 -ml-4 flex flex-col gap-3 py-3 pr-3 pl-4 transition-colors hover:bg-primary/15">
      <div className="flex min-w-0 items-stretch gap-3">
        {/* As wide as the icon, so its left edge is the left edge of the bar below. The padding and the negative margin of the card keep the content in line with the heatmap while the hover color reaches past it, like a session card. */}
        <span className="flex w-9 shrink-0 items-center justify-center text-primary" aria-hidden>
          <Icon className="size-9" />
        </span>
        <div className="min-w-0 flex-1">
          {/* The reward sits on the title row only, so the description under it keeps the whole width of the card. */}
          <div className="flex min-w-0 items-baseline gap-3">
            <p className="min-w-0 flex-1 truncate text-xl font-extrabold text-primary/80" title={task.title}>{task.title}</p>
            {/* Top right: the reward, shown while the card is hovered (always on touch screens), muted until the server paid it, then in the theme red with a plus. */}
            {task.coins > 0 && (
              <span className={cn('shrink-0 text-lg font-extrabold transition-opacity pointer-fine:opacity-0 pointer-fine:group-focus-within:opacity-100 pointer-fine:group-hover:opacity-100', task.rewarded ? 'text-primary/80' : 'text-muted-foreground')}>
                <Coins className="mr-1.5 inline size-[18px] align-text-bottom" aria-hidden />
                {task.rewarded ? `+${task.coins} coins` : `${task.coins} coins`}
              </span>
            )}
          </div>
          {task.description && <p className="line-clamp-2 text-base text-muted-foreground">{task.description}</p>}
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
 * sessions under them do not jump; when they fail, the reason and a retry on one line; a day
 * without tasks (no task is active) is one muted line. With `onSwitch` a button next to the title shows the error profile
 * in its place (`PanelTitleSwitch`, the profile page).
 */
export const ProfileDailyTasks = ({ onSwitch }: { onSwitch?: () => void } = {}) => {
  const dailyTasks = useDailyTasks();
  const [page, setPage] = useState(1);

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
    const ordered = oldestFirst(dailyTasks.data.tasks);
    const totalPages = Math.ceil(ordered.length / TASKS_PER_PAGE);
    // A page past the end (the tasks changed) shows the last one.
    const current = Math.min(page, totalPages);
    return (
      <>
        <ul className={gridClass}>
          {ordered.slice((current - 1) * TASKS_PER_PAGE, current * TASKS_PER_PAGE).map((task) => (
            <DailyTaskItem key={task.id} task={task} />
          ))}
        </ul>
        {totalPages > 1 && <Pagination page={current} totalPages={totalPages} onPageChange={setPage} variant="toolbar" accent plain flushRight />}
      </>
    );
  };

  // How many of today's tasks are done, on the right of the title: "2 / 3".
  const tasks = dailyTasks.data?.tasks ?? [];
  const done = tasks.filter((task) => task.completed).length;
  const allDone = tasks.length > 0 && done === tasks.length;

  return (
    <section aria-label="Daily tasks" aria-busy={dailyTasks.isPending}>
      {/* PANEL Daily tasks */}
      <Panel
        title="Daily tasks"
        titleAction={onSwitch && <PanelTitleSwitch other="Error profile" onClick={onSwitch} />}
        bare
        titleClassName={sectionTitleClass}
        className="space-y-4"
        actions={
          tasks.length > 0 && (
            <p className="inline-flex items-center gap-2 text-base font-medium text-primary">
              <CircleCheck className="size-4" aria-hidden />
              {done} / {tasks.length}
              <span className="sr-only"> done</span>
            </p>
          )
        }
      >
        {renderBody()}
        {allDone && (
          <p className="text-base text-primary">
            <CircleCheck className="mr-1.5 inline size-4 align-text-bottom" aria-hidden />
            Daily mission done
          </p>
        )}
      </Panel>
    </section>
  );
};
