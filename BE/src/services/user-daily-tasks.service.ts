// A learner's daily tasks (SCRUM-112): each of their days gets `dailyTaskCount` of the active DailyTask templates, picked at
// random, copied once into UserDailyTasks and measured on the counted sessions and minigames of that day, like the daily
// mission. typing-session.service.ts imports this file, so it never imports that one.
import type { Types } from 'mongoose';
import { DailyTaskModel } from '../models/daily-task.model';
import { TypingSessionDocument, TypingSessionModel } from '../models/typing-session.model';
import { DayNumbers, UserDailyTask, UserDailyTasksDocument, UserDailyTasksModel } from '../models/user-daily-tasks.model';
import { UserModel } from '../models/user.model';
import { notFound } from '../utils/app-error';
import { addDays, localDateKey } from '../utils/local-date';
import { getAppSettings } from './app-setting.service';
import { learnerTimeZone, usableTimeZone } from './daily-progress.service';
import { minigameFinishTimes } from './minigame-times.service';

type OwnerId = string | Types.ObjectId;

/**
 * Picks `count` of `templates` at random, never one twice. `random` returns a number from 0 up to 1, like `Math.random`;
 * the unit tests pass their own.
 */
export const pickDailyTasks = <T>(templates: readonly T[], count: number, random = Math.random): T[] => {
  const left = [...templates];
  const picked: T[] = [];
  while (picked.length < count && left.length > 0) {
    picked.push(...left.splice(Math.floor(random() * left.length), 1));
  }
  return picked;
};

/** What the numbers of a day are made of: the fields of a counted session that `countedSessionsOf` reads. */
export type DaySession = Pick<TypingSessionDocument, 'completedAt'>;

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
    .select('completedAt')
    .lean();
  return sessions.filter((session) => localDateKey(session.completedAt!, timeZone) === date);
};

/**
 * How many minigames and ranked duels the learner finished on `date`, a day in `timeZone` (SCRUM-300): the finish times in the
 * same whole UTC days `countedSessionsOf` reads, cut like DailyProgress.
 */
const minigameCountOf = async (owner: OwnerId, date: string, timeZone: string) => {
  const times = await minigameFinishTimes([owner], new Date(`${addDays(date, -1)}T00:00:00Z`), new Date(`${addDays(date, 2)}T00:00:00Z`));
  return (times.get(String(owner)) ?? []).filter((time) => localDateKey(time, timeZone) === date).length;
};

/**
 * The numbers of a day: how many counted sessions it has, and how many minigames and ranked duels the learner finished
 * that day (minigame-times.service.ts), which are not sessions.
 */
export const dayNumbersOf = (sessions: readonly unknown[], minigames = 0): DayNumbers => ({ sessions: sessions.length, minigames });

/** How far a task is on the numbers of its day, in the unit of its target, and whether it is completed. */
export const taskProgressOf = ({ type, target }: Pick<UserDailyTask, 'type' | 'target'>, numbers: DayNumbers) => {
  // A day stored before minigames existed has no number: 0.
  const done = type === 'sessions' ? numbers.sessions : (numbers.minigames ?? 0);
  return { progress: done, completed: done >= target };
};

/**
 * When a learner's day completed `task`: the time of its `target`th counted session (`sessions`, oldest first) or of its
 * `target`th minigame (`minigameTimes`, oldest first); `undefined` when the day never gets there.
 */
export const completedAtOf = (
  task: Pick<UserDailyTask, 'type' | 'target'>,
  sessions: readonly DaySession[],
  minigameTimes: readonly Date[] = []
) => (task.type === 'minigames' ? minigameTimes[task.target - 1] : sessions[task.target - 1]?.completedAt);

/**
 * The learner's tasks of `date` (a day in `timeZone`), made the first time they are needed: `dailyTaskCount` of the
 * active templates (`pickDailyTasks`), with the numbers of the sessions already counted that day,
 * cut in `timeZone`, which the day keeps. Stored once with `$setOnInsert` on the unique `{ owner, date }`: of two requests
 * at the same time, one makes the snapshot and the other gets it, maybe cut in another zone (`updateDayNumbers`). The
 * stored tasks are never changed, so template edits and a new `dailyTaskCount` apply from the next day. `null` while no
 * template is active: nothing is stored, so a template activated later that day still gives the learner tasks.
 */
const tasksOfDay = async (owner: OwnerId, date: string, timeZone: string) => {
  const stored = await UserDailyTasksModel.findOne({ owner, date });
  if (stored) return stored;

  const [{ dailyTaskCount }, templates] = await Promise.all([
    getAppSettings(),
    // In the order they were made, so the picks depend on `random` alone.
    DailyTaskModel.find({ isActive: true }).sort({ _id: 1 }).select('title description type target coins').lean()
  ]);
  const tasks: UserDailyTask[] = pickDailyTasks(templates, dailyTaskCount).map(({ _id, title, description, type, target, coins }) => ({
    taskId: _id,
    title,
    description,
    type,
    target,
    coins: coins ?? 0
  }));
  if (tasks.length === 0) return null;

  const [sessions, minigames] = await Promise.all([countedSessionsOf(owner, date, timeZone), minigameCountOf(owner, date, timeZone)]);
  const progress = dayNumbersOf(sessions, minigames);
  return UserDailyTasksModel.findOneAndUpdate(
    { owner, date },
    { $setOnInsert: { tasks, progress, timeZone } },
    { upsert: true, returnDocument: 'after' }
  );
};

/**
 * For the heatmap of the profile: by day (from `from` on, 'YYYY-MM-DD'), how many tasks the learner's day had and how many of
 * them are completed on the day's numbers. A day without tasks (made before any template was active) has no entry.
 */
export const taskCountsSince = async (owner: OwnerId, from: string) => {
  const days = await UserDailyTasksModel.find({ owner, date: { $gte: from } })
    .select('date tasks progress')
    .lean();
  return new Map(
    days.map((day) => [
      day.date,
      { tasksTotal: day.tasks.length, tasksDone: day.tasks.filter((task) => taskProgressOf(task, day.progress).completed).length }
    ])
  );
};

/** The admin list of templates shows how many learners completed each one in each of the last `COMPLETION_HOURS` hours. */
export const COMPLETION_HOURS = 24;
const HOUR_MS = 60 * 60 * 1000;

/**
 * For the admin list of templates: for each of `taskIds`, the learners who completed it in each of the last
 * `COMPLETION_HOURS` whole hours, the current one last (`hour` = its start), and in all of them (`learners`, each learner
 * once, also when two of their days had the task). A learner's day completes a task at the counted session that first
 * brings it to its target (`completedAtOf`), on the day's sessions cut in its `timeZone` like its stored numbers: no time
 * is stored, so the days made before this chart count too. Only the days whose stored numbers have the task completed
 * are read again.
 */
export const hourlyCompletionsOf = async (taskIds: readonly unknown[], now = new Date()) => {
  const firstHour = Math.floor(now.getTime() / HOUR_MS) * HOUR_MS - (COMPLETION_HOURS - 1) * HOUR_MS;
  const ids = new Set(taskIds.map(String));
  // A learner's day that ends after the first hour starts at most a day before it, in any zone.
  const days = await UserDailyTasksModel.find({
    'tasks.taskId': { $in: [...ids] },
    date: { $gte: addDays(localDateKey(new Date(firstHour), 'UTC'), -1) }
  })
    .select('owner date timeZone tasks progress')
    .lean();
  const completed = days.flatMap((day) =>
    day.tasks
      .filter((task) => ids.has(String(task.taskId)) && taskProgressOf(task, day.progress).completed)
      .map((task) => ({ day, task }))
  );

  // For each task, the owners who completed it in each hour.
  const ownersByHour = new Map([...ids].map((id) => [id, Array.from({ length: COMPLETION_HOURS }, () => new Set<string>())]));
  if (completed.length > 0) {
    const firstDate = completed.reduce((first, { day }) => (day.date < first ? day.date : first), completed[0].day.date);
    // Their counted sessions, oldest first, read from the UTC day before the first day like `countedSessionsOf` reads them.
    const sessions = await TypingSessionModel.find({
      owner: { $in: [...new Set(completed.map(({ day }) => String(day.owner)))] },
      status: 'completed',
      isCounted: true,
      completedAt: { $gte: new Date(`${addDays(firstDate, -1)}T00:00:00Z`), $lte: now }
    })
      .sort({ completedAt: 1 })
      .select('owner completedAt')
      .lean();
    // Their minigames and duels over the same time, for the `minigames` tasks.
    const owners = [...new Set(completed.map(({ day }) => String(day.owner)))];
    const minigameTimes = await minigameFinishTimes(owners, new Date(`${addDays(firstDate, -1)}T00:00:00Z`), new Date(now.getTime() + 1));
    const sessionsByOwner = new Map<string, typeof sessions>();
    for (const session of sessions) {
      const owned = sessionsByOwner.get(String(session.owner));
      if (owned) owned.push(session);
      else sessionsByOwner.set(String(session.owner), [session]);
    }
    for (const { day, task } of completed) {
      const owner = String(day.owner);
      const daySessions = (sessionsByOwner.get(owner) ?? []).filter(
        (session) => localDateKey(session.completedAt!, day.timeZone) === day.date
      );
      const dayMinigames = (minigameTimes.get(owner) ?? []).filter((time) => localDateKey(time, day.timeZone) === day.date);
      const at = completedAtOf(task, daySessions, dayMinigames)?.getTime();
      if (at === undefined || at < firstHour) continue;
      ownersByHour.get(String(task.taskId))![Math.floor((at - firstHour) / HOUR_MS)].add(owner);
    }
  }

  return (taskId: unknown) => {
    const hours = ownersByHour.get(String(taskId)) ?? [];
    return {
      learners: new Set(hours.flatMap((owners) => [...owners])).size,
      hours: hours.map((owners, index) => ({ hour: new Date(firstHour + index * HOUR_MS).toISOString(), learners: owners.size }))
    };
  };
};

/** `$max` of each number of the day, on the dotted paths of `progress`. */
const maxOfNumbers = (numbers: DayNumbers) => Object.fromEntries(Object.entries(numbers).map(([field, value]) => [`progress.${field}`, value]));

/**
 * Pays the coins (SCRUM-301) of every task of `day` that is completed on `numbers` and not paid yet. A task is marked
 * paid first, by a conditional update (`$ne`), and only the request that marks it adds the coins, so a task is paid once
 * however often the same session is recorded or two requests race. A task without coins is not marked. A failed payment is
 * only logged: it never fails the session, minigame or duel that completed the task, and the next recording pays it.
 */
const payCompletedTasks = async (owner: OwnerId, day: UserDailyTasksDocument, numbers: DayNumbers) => {
  for (const task of day.tasks) {
    const coins = task.coins ?? 0;
    if (coins <= 0 || !taskProgressOf(task, numbers).completed) continue;
    try {
      const marked = await UserDailyTasksModel.updateOne(
        { _id: day._id, rewardedTaskIds: { $ne: task.taskId } },
        { $push: { rewardedTaskIds: task.taskId } }
      );
      if (marked.modifiedCount === 0) continue;
      await UserModel.updateOne({ _id: owner }, { $inc: { coins } });
    } catch (error) {
      console.error('Daily task reward failed', error);
    }
  }
};

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
  const [sessions, minigames] = await Promise.all([
    countedSessionsOf(owner, day.date, timeZone),
    minigameCountOf(owner, day.date, timeZone)
  ]);
  const numbers = dayNumbersOf(sessions, minigames);
  if (day.timeZone !== timeZone) {
    const recut = await UserDailyTasksModel.updateOne(
      { _id: day._id, timeZone: { $ne: timeZone } },
      { $set: { progress: numbers, timeZone } }
    );
    if (recut.matchedCount > 0) {
      await payCompletedTasks(owner, day, numbers);
      return numbers;
    }
  }
  // The zone in the filter keeps numbers of one zone out of a day another request has just cut in another.
  await UserDailyTasksModel.updateOne({ _id: day._id, timeZone }, { $max: maxOfNumbers(numbers) });
  await payCompletedTasks(owner, day, numbers);
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
  // Read after the numbers were worked out again: that can pay a task, which the page then shows as paid.
  const paid = day.timeZone === timeZone ? day : await UserDailyTasksModel.findById(day._id).select('rewardedTaskIds').lean();
  const rewarded = new Set((paid?.rewardedTaskIds ?? []).map(String));
  return {
    date,
    tasks: day.tasks.map((task) => ({
      id: String(task.taskId),
      title: task.title,
      description: task.description,
      type: task.type,
      target: task.target,
      coins: task.coins ?? 0,
      rewarded: rewarded.has(String(task.taskId)),
      ...taskProgressOf(task, progress)
    }))
  };
};
