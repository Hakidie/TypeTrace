import type { WordErrorType } from '@/shared/lib/vietnamese-errors';

/** The kinds of task, in the order the form and the filter offer them (`DAILY_TASK_TYPES` in BE/src/models/daily-task.model.ts). */
export const DAILY_TASK_TYPES = ['sessions', 'minutes', 'wpm', 'accuracy'] as const;

export type DailyTaskType = (typeof DAILY_TASK_TYPES)[number];

/** A daily task template (SCRUM-210): what one of a learner's days may ask of them. */
export interface DailyTask {
  _id: string;
  title: string;
  /** '' when there is none. */
  description: string;
  type: DailyTaskType;
  target: number;
  /**
   * The error type an accuracy task focuses on (SCRUM-112): its accuracy is measured on that error only, and learners
   * weakest at it get the task first. Absent, or `null`, when the task has none.
   */
  errorType?: WordErrorType | null;
  /** Only active tasks are given to learners. */
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DailyTaskInput {
  title: string;
  description: string;
  type: DailyTaskType;
  target: number;
  /** Only an accuracy task may have one; `null` takes it away. */
  errorType?: WordErrorType | null;
  isActive: boolean;
}

export interface DailyTaskListParams {
  page?: number;
  limit?: number;
  q?: string;
  type?: DailyTaskType | '';
  /** `'true'` = active tasks, `'false'` = inactive ones, `''` = both. */
  isActive?: 'true' | 'false' | '';
  sort?: string;
}

/** The daily task part of the app settings (`GET/PUT /api/admin/daily-tasks/settings`). */
export interface DailyTaskSettings {
  /** How many of the active tasks each learner gets a day. */
  dailyTaskCount: number;
}
