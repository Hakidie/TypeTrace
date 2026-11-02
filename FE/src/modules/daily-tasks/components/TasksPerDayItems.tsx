import { MenuOption } from '@/shared/components/list-toolbar';
import { DropdownMenuItem } from '@/shared/components/ui/dropdown-menu';
import { MAX_DAILY_TASK_COUNT } from '../daily-tasks.config';
import { useActiveDailyTaskCount, useDailyTaskSettings, useUpdateDailyTaskSettings } from '../hooks/use-daily-tasks';

/** What `count` tasks a day means with the `active` tasks there are (unknown while they load). */
const hintOf = (count: number, active?: number) => {
  if (active === undefined) return 'How many of the active tasks each learner gets every day.';
  if (active === 0) return 'No task is active yet: learners get none until one is.';
  if (active < count) return `Only ${active} active ${active === 1 ? 'task' : 'tasks'}: learners get ${active} a day until more are active.`;
  if (active === count) return active === 1 ? 'Each learner gets the one active task every day.' : `Each learner gets all ${active} active tasks every day.`;
  return `Each learner gets ${count} of the ${active} active tasks every day.`;
};

const COUNTS = Array.from({ length: MAX_DAILY_TASK_COUNT }, (_, index) => index + 1);

const noteClass = 'max-w-64 px-2 py-1 text-sm';

/**
 * The items of the Tasks per day menu in the toolbar of the task list (an app setting, `dailyTaskCount`): what the saved
 * count means with the active tasks, then 1 to `MAX_DAILY_TASK_COUNT` a day with the saved one checked; picking another
 * saves it at once. While it loads a muted line; when it could not load, the reason and Try again.
 */
export const TasksPerDayItems = () => {
  const settings = useDailyTaskSettings();
  const active = useActiveDailyTaskCount();
  const save = useUpdateDailyTaskSettings();

  if (settings.isPending) return <p className={`${noteClass} text-muted-foreground`}>Loading…</p>;
  if (settings.isError) {
    return (
      <>
        <p className={`${noteClass} text-destructive`}>The tasks per day could not load.</p>
        <DropdownMenuItem onClick={() => void settings.refetch()}>Try again</DropdownMenuItem>
      </>
    );
  }
  const saved = settings.data.dailyTaskCount;
  return (
    <>
      <p className={`${noteClass} text-muted-foreground`}>{hintOf(saved, active.data)}</p>
      {COUNTS.map((count) => (
        <MenuOption key={count} selected={count === saved} onSelect={() => count !== saved && save.mutate({ dailyTaskCount: count })}>
          {count} a day
        </MenuOption>
      ))}
    </>
  );
};
