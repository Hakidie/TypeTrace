import { Gauge, Keyboard, Target, Timer, type LucideIcon } from 'lucide-react';
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
  minutes: { label: 'Minutes', stat: 'MINUTES', max: 120, icon: Timer },
  wpm: { label: 'Speed', stat: 'WPM', max: 200, icon: Gauge },
  accuracy: { label: 'Accuracy', stat: 'ACC', max: 100, icon: Target },
};

/** The most tasks a learner may get a day (`MAX_DAILY_TASK_COUNT` in BE/src/models/app-setting.model.ts). */
export const MAX_DAILY_TASK_COUNT = 10;

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** What a task asks, in words: "Finish 3 counted sessions", "Reach 40 WPM in one session". */
export const goalOf = ({ type, target }: Pick<DailyTask, 'type' | 'target'>) => {
  switch (type) {
    case 'sessions':
      return `Finish ${plural(target, 'counted session')}`;
    case 'minutes':
      return `Type ${plural(target, 'minute')} in all`;
    case 'wpm':
      return `Reach ${target} WPM in one session`;
    case 'accuracy':
      return `Reach ${target}% accuracy in one session`;
  }
};

/** The target as the row shows it: `95%` for accuracy, the number otherwise. */
export const formatTarget = ({ type, target }: Pick<DailyTask, 'type' | 'target'>) =>
  type === 'accuracy' ? `${target}%` : String(target);
