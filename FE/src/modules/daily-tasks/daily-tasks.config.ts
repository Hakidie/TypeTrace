import { Gamepad2, Keyboard, type LucideIcon } from 'lucide-react';
import type { DailyTask, DailyTaskType } from './types/daily-task.types';

interface DailyTaskTypeInfo {
  /** Name in the form, the filter and the badge. */
  label: string;
  /** Label of the target on a task row, like the `WPM` / `ACC` of the user rows. */
  stat: string;
  /** The largest target (`DAILY_TASK_TARGET_MAX` in BE/src/models/daily-task.model.ts: keep the two the same). */
  max: number;
  icon: LucideIcon;
}

export const DAILY_TASK_TYPE_INFO: Record<DailyTaskType, DailyTaskTypeInfo> = {
  sessions: { label: 'Sessions', stat: 'SESSIONS', max: 20, icon: Keyboard },
  minigames: { label: 'Minigames', stat: 'GAMES', max: 10, icon: Gamepad2 },
};

/** The most tasks a learner may get a day (`MAX_DAILY_TASK_COUNT` in BE/src/models/app-setting.model.ts). */
export const MAX_DAILY_TASK_COUNT = 10;

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** What a task asks, in words: "Finish 3 counted sessions", "Finish 2 minigames". */
export const goalOf = ({ type, target }: Pick<DailyTask, 'type' | 'target'>) =>
  type === 'sessions' ? `Finish ${plural(target, 'counted session')}` : `Finish ${plural(target, 'minigame')}`;

/** The most coins one task can give (`DAILY_TASK_COINS_MAX` in BE/src/models/daily-task.model.ts: keep the two the same). */
export const DAILY_TASK_COINS_MAX = 100;

/** The target as the row shows it. */
export const formatTarget = ({ target }: Pick<DailyTask, 'target'>) => String(target);
