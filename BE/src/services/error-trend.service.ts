// The error rate of each error type over time (SCRUM-30, US4.2): the points of the second chart of the Progress page, over the
// same periods as the WPM chart (`chartKeys`: a year by month, a month by block of 7 days, a week by day). Worked out from the
// counted sessions each time it is read and never stored, like the error profile.
import { TypingSessionModel } from '../models/typing-session.model';
import { UserModel } from '../models/user.model';
import { notFound } from '../utils/app-error';
import { localDateKey } from '../utils/local-date';
import { errorTypesOf, type SessionErrorType, sessionsIn, type TypingLanguage } from '../utils/typing-language';
import { usableTimeZone } from './daily-progress.service';
import { type ChartRange, chartKeys, firstDayOf, keyOfDay, mongoTimeZone } from './monthly-progress.service';

/** What the counted sessions of one local day add up to: the errors and the chances of each error type (a missing type is 0). */
export interface ErrorDayTotals {
  errors: Partial<Record<SessionErrorType, number>>;
  opportunities: Partial<Record<SessionErrorType, number>>;
}

export interface ErrorTrendPoint {
  /** The period: 'YYYY-MM' (`year`), the first day of the block 'YYYY-MM-DD' (`month`) or the day 'YYYY-MM-DD' (`week`), in the learner's zone. */
  key: string;
  /** Per type: errors / chances of the period in %, one decimal, at most 100; `null` when the period gave no chance of it (a gap, never 0). */
  rates: Partial<Record<SessionErrorType, number | null>>;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * The points of the chart (a pure function). `keys` = the keys of the periods, oldest first. `days` = the totals of each local
 * day with counted sessions. The rate of a period is the sum of the errors over the sum of the chances of its days (not an
 * average of the days: a day with 3 chances weighs less than one with 300). A period that has not started (the months after
 * this one, the days after `today`) is left out.
 */
export const buildErrorTrend = (
  range: ChartRange,
  keys: readonly string[],
  days: ReadonlyMap<string, ErrorDayTotals>,
  types: readonly SessionErrorType[],
  today: string
): ErrorTrendPoint[] => {
  const sums = new Map<string, { errors: Record<string, number>; opportunities: Record<string, number> }>();
  for (const [day, totals] of days) {
    const key = keyOfDay(range, day);
    const sum = sums.get(key) ?? { errors: {}, opportunities: {} };
    for (const type of types) {
      sum.errors[type] = (sum.errors[type] ?? 0) + (totals.errors[type] ?? 0);
      sum.opportunities[type] = (sum.opportunities[type] ?? 0) + (totals.opportunities[type] ?? 0);
    }
    sums.set(key, sum);
  }
  return keys
    .filter((key) => firstDayOf(key) <= today)
    .map((key) => {
      const sum = sums.get(key);
      return {
        key,
        rates: Object.fromEntries(
          types.map((type) => {
            const chances = sum?.opportunities[type] ?? 0;
            return [type, chances === 0 ? null : Math.min(100, round1(((sum?.errors[type] ?? 0) / chances) * 100))];
          })
        )
      };
    });
};

/**
 * `GET /api/profile/error-trend?range=year|month|week&date=&language=`: the error rate of each error type of one typing language
 * (the learner's Practice language when missing, SCRUM-219: the two sets do not mix) in each period of the range, cut in the
 * learner's time zone. The token of a deleted account passes `authGuard`: it answers 404, like the other profile endpoints.
 */
export const getErrorTrend = async (userId: string, range: ChartRange = 'year', date?: string, language?: TypingLanguage) => {
  const user = await UserModel.findById(userId).select('settings.timezone settings.typingLanguage').lean();
  if (!user) throw notFound('User not found');
  const shown = language ?? user.settings?.typingLanguage ?? 'vi';
  const timeZone = usableTimeZone(user.settings?.timezone);
  const today = localDateKey(new Date(), timeZone);
  const types = errorTypesOf(shown);

  // One row per local day with counted sessions, the sums of each type: the periods are built from them.
  const rows = await TypingSessionModel.aggregate<{ _id: string } & Record<string, number>>([
    { $match: { owner: user._id, status: 'completed', isCounted: true, completedAt: { $exists: true }, ...sessionsIn(shown) } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt', timezone: mongoTimeZone(timeZone) } },
        ...Object.fromEntries(types.flatMap((type) => [[`e_${type}`, { $sum: `$errorCounts.${type}` }], [`o_${type}`, { $sum: `$opportunityCounts.${type}` }]]))
      }
    }
  ]);
  const days = new Map<string, ErrorDayTotals>(
    rows.map((row) => [
      row._id,
      {
        errors: Object.fromEntries(types.map((type) => [type, row[`e_${type}`] ?? 0])),
        opportunities: Object.fromEntries(types.map((type) => [type, row[`o_${type}`] ?? 0]))
      }
    ])
  );
  return { range, language: shown, types, points: buildErrorTrend(range, chartKeys(range, today, date), days, types, today) };
};
