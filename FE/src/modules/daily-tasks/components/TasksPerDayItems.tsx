import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { MenuOption } from '@/shared/components/list-toolbar';
import { DropdownMenuItem } from '@/shared/components/ui/dropdown-menu';
import { MAX_DAILY_TASK_COUNT } from '../daily-tasks.config';
import { useActiveDailyTaskCount, useDailyTaskSettings, useUpdateDailyTaskSettings } from '../hooks/use-daily-tasks';

/** What `count` tasks a day means with the `active` tasks there are (unknown while they load). */
const hintOf = (t: TFunction<'dailyTasks'>, count: number, active?: number) => {
  if (active === undefined) return t('perDay.hintUnknown');
  if (active === 0) return t('perDay.hintNone');
  if (active < count) return t('perDay.hintFewer', { count: active });
  if (active === count) return active === 1 ? t('perDay.hintOnlyOne') : t('perDay.hintAll', { count: active });
  return t('perDay.hintSome', { count, active });
};

const COUNTS = Array.from({ length: MAX_DAILY_TASK_COUNT }, (_, index) => index + 1);

const noteClass = 'max-w-64 px-2 py-1 text-sm';

/**
 * The items of the Tasks per day menu in the toolbar of the task list (an app setting, `dailyTaskCount`): what the saved
 * count means with the active tasks, then 1 to `MAX_DAILY_TASK_COUNT` a day with the saved one checked; picking another
 * saves it at once. While it loads a muted line; when it could not load, the reason and Try again.
 */
export const TasksPerDayItems = () => {
  const { t } = useTranslation('dailyTasks');
  const settings = useDailyTaskSettings();
  const active = useActiveDailyTaskCount();
  const save = useUpdateDailyTaskSettings();

  if (settings.isPending) return <p className={`${noteClass} text-muted-foreground`}>{t('perDay.loading')}</p>;
  if (settings.isError) {
    return (
      <>
        <p className={`${noteClass} text-destructive`}>{t('perDay.couldNotLoad')}</p>
        <DropdownMenuItem onClick={() => void settings.refetch()}>{t('common:actions.tryAgain')}</DropdownMenuItem>
      </>
    );
  }
  const saved = settings.data.dailyTaskCount;
  return (
    <>
      <p className={`${noteClass} text-muted-foreground`}>{hintOf(t, saved, active.data)}</p>
      {COUNTS.map((count) => (
        <MenuOption key={count} selected={count === saved} onSelect={() => count !== saved && save.mutate({ dailyTaskCount: count })}>
          {t('perDay.value', { count })}
        </MenuOption>
      ))}
    </>
  );
};
