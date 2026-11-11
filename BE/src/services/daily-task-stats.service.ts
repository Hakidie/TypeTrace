// How many learners completed daily tasks over time: the points of the bar chart of the admin Daily tasks page. Built like the
// chart of the admin Plans page (`getPlanUsersOverTime`): the same ranges and keys (`chartKeys`), one point a month (`year`), a
// block of 7 days (`month`) or a day (`week`).
import { UserDailyTasksModel } from '../models/user-daily-tasks.model';
import { localDateKey } from '../utils/local-date';
import { ChartRange, chartKeys, keyOfDay } from './monthly-progress.service';
import { taskProgressOf } from './user-daily-tasks.service';

/** The admin chart is read in Vietnam time, like the Plans chart. */
const ADMIN_ZONE = 'Asia/Ho_Chi_Minh';

export interface TaskCompletionsPoint {
  /** The period: 'YYYY-MM' (`year`), the first day of the block (`month`) or the day (`week`), as in the Progress chart. */
  key: string;
  /** The learners who completed at least one task in the period (each one once, however many days or tasks). */
  learners: number;
  /** The tasks completed in the period, one for each learner and day. */
  tasks: number;
  /** The learners who completed each task (by template) in the period, each once; only the tasks somebody completed. */
  byTask: { taskId: string; learners: number }[];
}

export interface TaskCompletions {
  /** Every task completed by somebody in the periods, the one with the most learners first. */
  tasks: { taskId: string; title: string }[];
  points: TaskCompletionsPoint[];
}

/**
 * The chart: the points, each with the learners of every task, and the tasks the bars stand for. A learner's day (`UserDailyTasks`, a day in the learner's own zone) counts in the period that holds
 * its date, with the tasks its stored numbers complete. Periods that have not started are left out. `date` (a day) picks the
 * year, month or week as in the Progress chart; without it the range ends today.
 */
export const getTaskCompletionsOverTime = async (range: ChartRange, date?: string, now = new Date()): Promise<TaskCompletions> => {
  const today = localDateKey(now, ADMIN_ZONE);
  const keys = chartKeys(range, today, date).filter((key) => (key.length === 7 ? `${key}-01` : key) <= today);
  if (keys.length === 0) return { tasks: [], points: [] };

  const first = keys[0].length === 7 ? `${keys[0]}-01` : keys[0];
  const days = await UserDailyTasksModel.find({ date: { $gte: first } })
    .select('owner date tasks progress')
    .lean();

  const buckets = new Map(keys.map((key) => [key, { owners: new Set<string>(), tasks: 0, byTask: new Map<string, Set<string>>() }]));
  // The title each task had in the newest day that completed it, and the learners it had in all.
  const titles = new Map<string, { title: string; date: string; owners: Set<string> }>();
  for (const day of days) {
    const bucket = buckets.get(keyOfDay(range, day.date));
    if (!bucket) continue;
    const owner = String(day.owner);
    for (const task of day.tasks) {
      if (!taskProgressOf(task, day.progress).completed) continue;
      const taskId = String(task.taskId);
      bucket.owners.add(owner);
      bucket.tasks += 1;
      const owners = bucket.byTask.get(taskId) ?? new Set<string>();
      owners.add(owner);
      bucket.byTask.set(taskId, owners);
      const known = titles.get(taskId);
      if (!known) titles.set(taskId, { title: task.title, date: day.date, owners: new Set([owner]) });
      else {
        known.owners.add(owner);
        if (day.date > known.date) Object.assign(known, { title: task.title, date: day.date });
      }
    }
  }
  const tasks = [...titles]
    .sort(([, a], [, b]) => b.owners.size - a.owners.size || a.title.localeCompare(b.title))
    .map(([taskId, { title }]) => ({ taskId, title }));
  const points = keys.map((key) => {
    const bucket = buckets.get(key)!;
    return {
      key,
      learners: bucket.owners.size,
      tasks: bucket.tasks,
      byTask: [...bucket.byTask].map(([taskId, owners]) => ({ taskId, learners: owners.size }))
    };
  });
  return { tasks, points };
};
