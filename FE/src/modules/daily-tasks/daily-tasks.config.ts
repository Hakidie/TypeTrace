import { Gamepad2, Keyboard, type LucideIcon } from 'lucide-react';
import { i18n } from '@/shared/i18n/i18n';
import type { DailyTask, DailyTaskType } from './types/daily-task.types';

interface DailyTaskTypeInfo {
  /** Name in the form, the filter and the badge, in the language of the interface. */
  readonly label: string;
  /** Label of the target on a task row, like the `WPM` / `ACC` of the user rows, in the language of the interface. */
  readonly stat: string;
  /** The largest target (`DAILY_TASK_TARGET_MAX` in BE/src/models/daily-task.model.ts: keep the two the same). */
  max: number;
  icon: LucideIcon;
}

/** The words are read when they are used, so they follow the language of the interface (`dailyTasks:types`, `stats`). */
const typeInfo = (type: DailyTaskType, max: number, icon: LucideIcon): DailyTaskTypeInfo => ({
  get label() {
    return i18n.t(`dailyTasks:types.${type}`);
  },
  get stat() {
    return i18n.t(`dailyTasks:stats.${type}`);
  },
  max,
  icon,
});

export const DAILY_TASK_TYPE_INFO: Record<DailyTaskType, DailyTaskTypeInfo> = {
  sessions: typeInfo('sessions', 20, Keyboard),
  minigames: typeInfo('minigames', 10, Gamepad2),
};

/** The most tasks a learner may get a day (`MAX_DAILY_TASK_COUNT` in BE/src/models/app-setting.model.ts). */
export const MAX_DAILY_TASK_COUNT = 10;

/** What a task asks, in words: "Finish 3 counted sessions", "Finish 2 minigames" (in the language of the interface). */
export const goalOf = ({ type, target }: Pick<DailyTask, 'type' | 'target'>) => i18n.t(`dailyTasks:goal.${type}`, { count: target });

/** The most coins one task can give (`DAILY_TASK_COINS_MAX` in BE/src/models/daily-task.model.ts: keep the two the same). */
export const DAILY_TASK_COINS_MAX = 100;

/** The target as the row shows it. */
export const formatTarget = ({ target }: Pick<DailyTask, 'target'>) => String(target);
