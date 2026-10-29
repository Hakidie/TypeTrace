// A learner's daily tasks (SCRUM-112): each of their days gets `dailyTaskCount` of the active DailyTask templates, the
// ones that focus on their weakest error types first, copied once into UserDailyTasks and measured on the counted
// sessions of that day, like the daily mission. typing-session.service.ts imports this file, so it never imports that one.
import type { Types } from 'mongoose';
import { DailyTaskModel } from '../models/daily-task.model';
import { ErrorCounts, TypingSessionDocument, TypingSessionModel } from '../models/typing-session.model';
import { DayNumbers, UserDailyTask, UserDailyTasksDocument, UserDailyTasksModel } from '../models/user-daily-tasks.model';
import { UserModel } from '../models/user.model';
import { notFound } from '../utils/app-error';
import { addDays, localDateKey } from '../utils/local-date';
import { WordError, WordErrorType } from '../utils/vietnamese-errors';
import { getAppSettings } from './app-setting.service';
import { learnerTimeZone, usableTimeZone } from './daily-progress.service';

/** The error profile behind the picks: the learner's last counted sessions, so it follows them as they improve. */
export const WEAKNESS_SESSIONS = 20;
/** An error type is weak only with at least this many chances in those sessions (fewer say little) and an error. */
export const MIN_WEAKNESS_CHANCES = 10;
/** A session counts for a task that focuses on an error type only with at least this many chances of that type. */
export const MIN_FOCUS_CHANCES = 5;

type OwnerId = string | Types.ObjectId;

const round1 = (value: number) => Math.round(value * 10) / 10;

const emptyCounts = (): ErrorCounts =>
  Object.fromEntries(Object.values(WordError).map((type) => [type, 0])) as ErrorCounts;

/**
 * The weak error types of a learner, weakest first, from their errors and chances of each type in all: the types with
 * at least `MIN_WEAKNESS_CHANCES` chances and at least one error, by error rate (errors / chances). A tie goes to the
 * type with more errors, then to the order of WordError.
 */
export const rankWeakErrorTypes = (errors: ErrorCounts, chances: ErrorCounts): WordErrorType[] => {
  const order = Object.values(WordError);
  const rate = (type: WordErrorType) => errors[type] / chances[type];
  return order
    .filter((type) => chances[type] >= MIN_WEAKNESS_CHANCES && errors[type] > 0)
    .sort((a, b) => rate(b) - rate(a) || errors[b] - errors[a] || order.indexOf(a) - order.indexOf(b));
};

/**
 * The learner's weak error types (`rankWeakErrorTypes`) in their last `WEAKNESS_SESSIONS` counted sessions. A session
 * adds its errors and chances of a type only with at least `MIN_FOCUS_CHANCES` chances of it, the sessions that can move
 * a task focused on that type (`dayNumbersOf`): a type met only a few times in each of them would otherwise be ranked
 * weak and handed out as a task that sessions like theirs never move.
 */
const weakErrorTypesOf = async (owner: OwnerId) => {
  const sessions = await TypingSessionModel.find({ owner, status: 'completed', isCounted: true })
    .sort({ completedAt: -1 })
    .limit(WEAKNESS_SESSIONS)
    .select('errorCounts opportunityCounts')
    .lean();
  const errors = emptyCounts();
  const chances = emptyCounts();
  for (const session of sessions) {
    for (const type of Object.values(WordError)) {
      const sessionChances = session.opportunityCounts?.[type] ?? 0;
      if (sessionChances < MIN_FOCUS_CHANCES) continue;
      errors[type] += session.errorCounts?.[type] ?? 0;
      chances[type] += sessionChances;
    }
  }
  return rankWeakErrorTypes(errors, chances);
};

/**
 * Picks the tasks of a day from `templates`: first, for each weak error type in order, one of the templates that focus
 * on it (at random among them; a type no template focuses on is skipped), then the places left at random from all the
 * other templates. Never a template twice, at most `count`. `random` returns a number from 0 up to 1, like `Math.random`;
 * the unit tests pass their own.
 */
export const pickDailyTasks = <T extends { errorType?: WordErrorType }>(
  templates: readonly T[],
  weakTypes: readonly WordErrorType[],
  count: number,
  random = Math.random
): T[] => {
  const left = [...templates];
  const picked: T[] = [];
  const pickFrom = (candidates: T[]) => {
    const choice = candidates[Math.floor(random() * candidates.length)];
    picked.push(choice);
    left.splice(left.indexOf(choice), 1);
  };
  for (const type of weakTypes) {
    if (picked.length >= count) break;
    const focused = left.filter((template) => template.errorType === type);
    if (focused.length > 0) pickFrom(focused);
  }
  while (picked.length < count && left.length > 0) pickFrom(left);
  return picked;
};

/** What the numbers of a day are made of: the fields of a counted session that `countedSessionsOf` reads. */
export type DaySession = Pick<TypingSessionDocument, 'durationMs' | 'wpm' | 'accuracy' | 'errorCounts' | 'opportunityCounts'>;

/**
 * The learner's counted sessions completed on `date`, a day in `timeZone`. The query reads whole UTC days, from the one
 * before `date` to the one after it: they hold `date` in any zone less than 24 hours from UTC, so in every zone `Intl`
 * takes, the IANA ones (UTC-12 to UTC+14) and offsets such as '+15:00' or '-23:59' alike (`isValidTimeZone` lets those
 * through). `localDateKey` then keeps the sessions of the day itself, cut like DailyProgress.
 */
const countedSessionsOf = async (owner: OwnerId, date: string, timeZone: string) => {
  const sessions = await TypingSessionModel.find({
    owner,
    status: 'completed',
    isCounted: true,
    completedAt: { $gte: new Date(`${addDays(date, -1)}T00:00:00Z`), $lt: new Date(`${addDays(date, 2)}T00:00:00Z`) }
  })
    .select('completedAt durationMs wpm accuracy errorCounts opportunityCounts')
    .lean();
  return sessions.filter((session) => localDateKey(session.completedAt!, timeZone) === date);
};

/**
 * The numbers of a day from its counted sessions: how many, their time in all, the best WPM and the best accuracy of one
 * of them, and for each error type the best accuracy on it, `100 * (1 - errors / chances)` to one decimal, of one session
 * with at least `MIN_FOCUS_CHANCES` chances of it. A field a session lacks counts as 0.
 */
export const dayNumbersOf = (sessions: readonly DaySession[]): DayNumbers => {
  const bestErrorAccuracy: DayNumbers['bestErrorAccuracy'] = {};
  for (const { errorCounts, opportunityCounts } of sessions) {
    for (const type of Object.values(WordError)) {
      const chances = opportunityCounts?.[type] ?? 0;
      if (chances < MIN_FOCUS_CHANCES) continue;
      // Not below 0: a word without a vowel mark can still be typed with one, so MARK_WRONG can have more errors than chances.
      const accuracy = Math.max(0, round1(100 * (1 - (errorCounts?.[type] ?? 0) / chances)));
      bestErrorAccuracy[type] = Math.max(bestErrorAccuracy[type] ?? 0, accuracy);
    }
  }
  return {
    sessions: sessions.length,
    durationMs: sessions.reduce((total, session) => total + (session.durationMs ?? 0), 0),
    bestWpm: Math.max(0, ...sessions.map((session) => session.wpm ?? 0)),
    bestAccuracy: Math.max(0, ...sessions.map((session) => session.accuracy ?? 0)),
    bestErrorAccuracy
  };
};

/**
 * How far a task is on the numbers of its day, in the unit of its target, and whether it is completed. `minutes` has one
 * decimal rounded down, so it never shows the target before the task is completed (at the exact millisecond). A focused
 * accuracy task is 0 until a session has `MIN_FOCUS_CHANCES` chances of its error type.
 */
export const taskProgressOf = (
  { type, target, errorType }: Pick<UserDailyTask, 'type' | 'target' | 'errorType'>,
  numbers: DayNumbers
) => {
  switch (type) {
    case 'sessions':
      return { progress: numbers.sessions, completed: numbers.sessions >= target };
    case 'minutes':
      return { progress: Math.floor(numbers.durationMs / 6000) / 10, completed: numbers.durationMs >= target * 60_000 };
    case 'wpm':
      return { progress: numbers.bestWpm, completed: numbers.bestWpm >= target };
    case 'accuracy': {
      const best = errorType ? (numbers.bestErrorAccuracy[errorType] ?? 0) : numbers.bestAccuracy;
      return { progress: best, completed: best >= target };
    }
  }
};

/**
 * The learner's tasks of `date` (a day in `timeZone`), made the first time they are needed: `dailyTaskCount` of the
 * active templates (`pickDailyTasks`, weak error types first), with the numbers of the sessions already counted that day,
 * cut in `timeZone`, which the day keeps. Stored once with `$setOnInsert` on the unique `{ owner, date }`: of two requests
 * at the same time, one makes the snapshot and the other gets it, maybe cut in another zone (`updateDayNumbers`). The
 * stored tasks are never changed, so template edits and a new `dailyTaskCount` apply from the next day. `null` while no
 * template is active: nothing is stored, so a template activated later that day still gives the learner tasks.
 */
const tasksOfDay = async (owner: OwnerId, date: string, timeZone: string) => {
  const stored = await UserDailyTasksModel.findOne({ owner, date });
  if (stored) return stored;

  const [{ dailyTaskCount }, templates, weakTypes] = await Promise.all([
    getAppSettings(),
    // In the order they were made, so the picks depend on `random` alone.
    DailyTaskModel.find({ isActive: true }).sort({ _id: 1 }).select('title description type target errorType').lean(),
    weakErrorTypesOf(owner)
  ]);
  const tasks: UserDailyTask[] = pickDailyTasks(templates, weakTypes, dailyTaskCount).map(
    ({ _id, title, description, type, target, errorType }) => ({ taskId: _id, title, description, type, target, ...(errorType && { errorType }) })
  );
  if (tasks.length === 0) return null;

  const progress = dayNumbersOf(await countedSessionsOf(owner, date, timeZone));
  return UserDailyTasksModel.findOneAndUpdate(
    { owner, date },
    { $setOnInsert: { tasks, progress, timeZone } },
    { upsert: true, returnDocument: 'after' }
  );
};

/** `$max` of each number of the day, on the dotted paths of `progress`. */
const maxOfNumbers = ({ bestErrorAccuracy, ...totals }: DayNumbers) =>
  Object.fromEntries([
    ...Object.entries(totals).map(([field, value]) => [`progress.${field}`, value]),
    ...Object.entries(bestErrorAccuracy).map(([type, value]) => [`progress.bestErrorAccuracy.${type}`, value])
  ]);

/**
 * Works the numbers of `day` out again from its counted sessions in `timeZone`, the learner's zone now, writes them and
 * answers them. In the zone the day is cut in, each number goes in with `$max`: the numbers only grow during a day, so a
 * repeated, late or out-of-order write never takes the day back. In another zone (the learner moved, or the day was made
 * by a request that read their zone before the browser's one was saved), the old numbers can count sessions of another
 * day and miss some of this one: the new ones replace them, together with the zone. Only once, through the `$ne` filter:
 * when another request has just cut the day in this zone, these numbers go in with `$max` like any other write, so a
 * request that read fewer sessions never takes the day back. Two names of one zone count as two zones here, which only
 * works the same numbers out again.
 */
const updateDayNumbers = async (owner: OwnerId, day: UserDailyTasksDocument, timeZone: string) => {
  const numbers = dayNumbersOf(await countedSessionsOf(owner, day.date, timeZone));
  if (day.timeZone !== timeZone) {
    const recut = await UserDailyTasksModel.updateOne(
      { _id: day._id, timeZone: { $ne: timeZone } },
      { $set: { progress: numbers, timeZone } }
    );
    if (recut.matchedCount > 0) return numbers;
  }
  // The zone in the filter keeps numbers of one zone out of a day another request has just cut in another.
  await UserDailyTasksModel.updateOne({ _id: day._id, timeZone }, { $max: maxOfNumbers(numbers) });
  return numbers;
};

/**
 * Brings the learner's tasks of the day of `completedAt` (in their zone) up to date after a counted session: makes the
 * day's tasks if nobody asked for them yet, then works the day's numbers out again from its counted sessions and writes
 * them (`updateDayNumbers`): recording the same session twice gives the same numbers. `completeSession` calls it once the
 * session is saved.
 */
export const recordDailyTaskProgress = async (owner: OwnerId, completedAt: Date) => {
  const timeZone = await learnerTimeZone(owner);
  const date = localDateKey(completedAt, timeZone);
  const day = await tasksOfDay(owner, date, timeZone);
  if (!day) return;
  await updateDayNumbers(owner, day, timeZone);
};

/**
 * `GET /api/profile/daily-tasks`: the learner's tasks of today in their zone, made by the day's first request or counted
 * session, each with its progress; never the owner or the stored numbers. Numbers cut in another zone are worked out
 * again in this one first (`updateDayNumbers`), so the page shows the learner's today as their zone has it now, also when
 * the day was made by a request that ran before the browser's zone was saved. The token of a deleted account answers 404,
 * like `getStreak`.
 */
export const getTodayDailyTasks = async (userId: string) => {
  const user = await UserModel.findById(userId).select('settings.timezone').lean();
  if (!user) throw notFound('User not found');
  const timeZone = usableTimeZone(user.settings?.timezone);
  const date = localDateKey(new Date(), timeZone);
  const day = await tasksOfDay(userId, date, timeZone);
  if (!day) return { date, tasks: [] };
  const progress = day.timeZone === timeZone ? day.progress : await updateDayNumbers(userId, day, timeZone);
  return {
    date,
    tasks: day.tasks.map((task) => ({
      id: String(task.taskId),
      title: task.title,
      description: task.description,
      type: task.type,
      target: task.target,
      ...(task.errorType && { errorType: task.errorType }),
      ...taskProgressOf(task, progress)
    }))
  };
};
