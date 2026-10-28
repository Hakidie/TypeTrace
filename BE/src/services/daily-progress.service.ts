// The learner's days (SCRUM-31): counted sessions per day in their own time zone (`DailyProgress`), the daily mission and
// the streak. Only counted sessions are recorded (`isCounted`, see `isSessionCounted` in typing-session.service.ts).
import type { Types } from 'mongoose';
import { DailyProgressModel } from '../models/daily-progress.model';
import { TypingSessionModel } from '../models/typing-session.model';
import { DEFAULT_TIMEZONE, UserModel } from '../models/user.model';
import { notFound } from '../utils/app-error';
import { addDays, isValidTimeZone, localDateKey } from '../utils/local-date';

/**
 * Counted sessions a learner must finish in one of their days to complete the daily mission. The frontend gets it as
 * `missionGoal`, so changing it needs no frontend change. Run `npm run rebuild:progress` afterwards: the days already
 * stored keep the `missionCompletedAt` of the old goal.
 */
export const DAILY_MISSION_SESSIONS = 1;

type OwnerId = string | Types.ObjectId;

/**
 * A stored zone this server does not know (edited by hand, or newer than its `Intl`) counts as the default one. Also
 * used by the daily tasks (user-daily-tasks.service.ts), so a learner's tasks and their streak share the same days.
 */
export const usableTimeZone = (name?: string | null) => (name && isValidTimeZone(name) ? name : DEFAULT_TIMEZONE);

/** The time zone of the learner's days: their `settings.timezone`, or the default for those who never sent one. */
export const learnerTimeZone = async (owner: OwnerId) => {
  const user = await UserModel.findById(owner).select('settings.timezone').lean();
  return usableTimeZone(user?.settings?.timezone);
};

/**
 * Adds one counted session to the learner's day: the day of `completedAt` in their time zone. One atomic upsert, so
 * sessions counted at the same time all add up in a single row (unique `{ owner, date }`). The first time the day reaches
 * `DAILY_MISSION_SESSIONS`, `missionCompletedAt` is set, once. Call it once per session: `completeSession` calls it only
 * in the request that completed the session.
 */
export const recordCountedSession = async (owner: OwnerId, completedAt: Date) => {
  const date = localDateKey(completedAt, await learnerTimeZone(owner));
  const day = await DailyProgressModel.findOneAndUpdate(
    { owner, date },
    { $inc: { sessions: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  if (day && day.sessions >= DAILY_MISSION_SESSIONS && !day.missionCompletedAt) {
    // The filter skips a row that already has the time, so a session counted at the same moment cannot move it.
    await DailyProgressModel.updateOne(
      { _id: day._id, missionCompletedAt: { $exists: false } },
      { $set: { missionCompletedAt: completedAt } }
    );
  }
};

/**
 * The streak of a learner. `dates` are their days with at least one counted session ('YYYY-MM-DD', in any order,
 * repeats allowed) and `today` is today in their zone. `current` = the days in a row ending today, or ending yesterday
 * while today has no session yet (the streak stays alive until the end of today), otherwise 0. `longest` = the longest
 * run ever, so never less than `current`.
 */
export const computeStreak = (dates: readonly string[], today: string) => {
  const active = new Set(dates);
  let current = 0;
  for (let day = active.has(today) ? today : addDays(today, -1); active.has(day); day = addDays(day, -1)) current += 1;

  let longest = 0;
  let run = 0;
  let previous = '';
  for (const day of [...active].sort()) {
    run = previous && addDays(previous, 1) === day ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }
  return { current, longest };
};

/**
 * `GET /api/profile/streak`: the learner's current and longest streak, and today's sessions and mission. The token of a
 * deleted account passes `authGuard`: it answers 404, like the other profile endpoints.
 */
export const getStreak = async (userId: string) => {
  const user = await UserModel.findById(userId).select('settings.timezone').lean();
  if (!user) throw notFound('User not found');
  const today = localDateKey(new Date(), usableTimeZone(user.settings?.timezone));
  const days = await DailyProgressModel.find({ owner: userId, sessions: { $gt: 0 } })
    .select('date sessions missionCompletedAt')
    .lean();
  const todayRow = days.find((day) => day.date === today);
  return {
    ...computeStreak(days.map((day) => day.date), today),
    today: {
      date: today,
      sessions: todayRow?.sessions ?? 0,
      missionGoal: DAILY_MISSION_SESSIONS,
      missionCompleted: Boolean(todayRow?.missionCompletedAt)
    }
  };
};

/**
 * The learner's days of the last `days` days in their zone, today included, oldest first: counted sessions and whether
 * the daily mission was done, with the zone the dates are in. `days` is `HEATMAP_DAYS`, passed in by
 * typing-session.service.ts (importing it here would make the two services import each other).
 */
export const recentProgressOf = async (owner: OwnerId, days: number) => {
  const timezone = await learnerTimeZone(owner);
  const today = localDateKey(new Date(), timezone);
  const rows = await DailyProgressModel.find({ owner, date: { $gte: addDays(today, 1 - days), $lte: today } })
    .sort({ date: 1 })
    .select('date sessions missionCompletedAt')
    .lean();
  return {
    timezone,
    sessions: rows.map((row) => ({ date: row.date, sessions: row.sessions, missionCompleted: Boolean(row.missionCompletedAt) }))
  };
};

/** Counted, completed sessions: the only ones DailyProgress holds. */
const countedSessions = { status: 'completed', isCounted: true, completedAt: { $exists: true } } as const;

/** The days of `times` (completion times, oldest first) in `timeZone`: sessions, and when the mission was done. */
const daysOf = (times: Date[], timeZone: string) => {
  const byDate = new Map<string, Date[]>();
  for (const time of times) {
    const date = localDateKey(time, timeZone);
    const day = byDate.get(date) ?? [];
    day.push(time);
    byDate.set(date, day);
  }
  return [...byDate].map(([date, sessions]) => ({
    date,
    sessions: sessions.length,
    missionCompletedAt: sessions[DAILY_MISSION_SESSIONS - 1] as Date | undefined
  }));
};

/**
 * Rebuilds every learner's DailyProgress from their counted sessions (`npm run rebuild:progress`), each in the learner's
 * current zone: the sessions of each day, and `missionCompletedAt` = when the `DAILY_MISSION_SESSIONS`-th of them was
 * completed. Rows no session supports (a session deleted, a day moved by a new zone, a deleted learner) are removed.
 * Running it twice gives the same rows. Days are cut by `localDateKey`, like live recording, so the two always agree.
 */
export const rebuildDailyProgress = async () => {
  const owners = await TypingSessionModel.distinct('owner', countedSessions);
  const learners = await UserModel.find({ _id: { $in: owners } }).select('settings.timezone').lean();
  let days = 0;
  let removed = 0;

  for (const learner of learners) {
    const sessions = await TypingSessionModel.find({ owner: learner._id, ...countedSessions })
      .sort({ completedAt: 1 })
      .select('completedAt')
      .lean();
    const rows = daysOf(
      sessions.map((session) => session.completedAt!),
      usableTimeZone(learner.settings?.timezone)
    );
    await DailyProgressModel.bulkWrite(
      rows.map(({ date, sessions: count, missionCompletedAt }) => ({
        updateOne: {
          filter: { owner: learner._id, date },
          update: missionCompletedAt
            ? { $set: { sessions: count, missionCompletedAt } }
            : { $set: { sessions: count }, $unset: { missionCompletedAt: 1 } },
          upsert: true
        }
      }))
    );
    const stale = await DailyProgressModel.deleteMany({ owner: learner._id, date: { $nin: rows.map((row) => row.date) } });
    days += rows.length;
    removed += stale.deletedCount;
  }

  // Learners without any counted session (or no longer in the database) keep no day.
  const others = await DailyProgressModel.deleteMany({ owner: { $nin: learners.map((learner) => learner._id) } });
  return { learners: learners.length, days, removed: removed + others.deletedCount };
};
