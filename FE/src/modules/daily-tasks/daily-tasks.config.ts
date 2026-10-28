import { Gauge, Keyboard, Target, Timer, type LucideIcon } from 'lucide-react';
import type { WordErrorType } from '@/shared/lib/vietnamese-errors';
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

/**
 * A session counts for a task that focuses on an error type only with at least this many chances of that type
 * (`MIN_FOCUS_CHANCES` in BE/src/services/user-daily-tasks.service.ts: keep the two the same).
 */
export const MIN_FOCUS_CHANCES = 5;

/** The error types as the goal of a focused accuracy task names them (the form's select uses `errorLabels` of the typing module). */
export const ERROR_FOCUS_LABELS: Record<WordErrorType, string> = {
  BASE_LETTER: 'letters',
  D_MISSING: 'the đ stroke',
  MARK_WRONG: 'vowel marks',
  TONE_WRONG: 'tone marks',
  HOI_NGA_CONFUSION: 'hỏi and ngã',
};

/**
 * The words that give a chance of an error type (`tagWord`), as the goal of a focused task names them. `null` where every
 * word is a chance: a counted session has at least 20 words (`MIN_COUNTED_WORDS` of the backend), so it always has
 * `MIN_FOCUS_CHANCES` of them.
 */
const ERROR_CHANCE_WORDS: Record<WordErrorType, string | null> = {
  BASE_LETTER: null,
  D_MISSING: 'words with đ',
  MARK_WRONG: 'words with vowel marks',
  TONE_WRONG: null,
  HOI_NGA_CONFUSION: 'words with hỏi or ngã',
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/**
 * What a task asks, in words: "Finish 3 counted sessions", "Reach 40 WPM in one session", and for an accuracy task with
 * a focus "Reach 90% accuracy on tone marks in one session". When only some words are a chance of the error of the focus,
 * the goal says how many of them a session needs, or the learner would see 0% after a session without them and not know
 * why: "Reach 90% accuracy on hỏi and ngã in a session with at least 5 words with hỏi or ngã". The focus counts on
 * accuracy tasks only.
 */
export const goalOf = ({ type, target, errorType }: Pick<DailyTask, 'type' | 'target' | 'errorType'>) => {
  switch (type) {
    case 'sessions':
      return `Finish ${plural(target, 'counted session')}`;
    case 'minutes':
      return `Type ${plural(target, 'minute')} in all`;
    case 'wpm':
      return `Reach ${target} WPM in one session`;
    case 'accuracy': {
      if (!errorType) return `Reach ${target}% accuracy in one session`;
      const chanceWords = ERROR_CHANCE_WORDS[errorType];
      const session = chanceWords ? `a session with at least ${MIN_FOCUS_CHANCES} ${chanceWords}` : 'one session';
      return `Reach ${target}% accuracy on ${ERROR_FOCUS_LABELS[errorType]} in ${session}`;
    }
  }
};

/** The target as the row shows it: `95%` for accuracy, the number otherwise. */
export const formatTarget = ({ type, target }: Pick<DailyTask, 'type' | 'target'>) =>
  type === 'accuracy' ? `${target}%` : String(target);
