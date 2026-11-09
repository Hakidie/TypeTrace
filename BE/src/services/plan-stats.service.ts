// How many users are on each plan over time (US11.1): the points of the line chart of the admin Plans page. Built like the chart of the
// Progress page: the same ranges and keys (`chartKeys`), one point a month (`year`), a block of 7 days (`month`) or a day (`week`).
import { SubscriptionModel } from '../models/subscription.model';
import { UserModel } from '../models/user.model';
import { addDays, localDateKey } from '../utils/local-date';
import { ChartRange, addMonths as addMonthsToKey, chartKeys, WEEK_DAYS } from './monthly-progress.service';

/** The admin chart is read in Vietnam time (no daylight saving there, so `+07:00` is always right). */
const ADMIN_ZONE = 'Asia/Ho_Chi_Minh';

export interface PlanUsersPoint {
  /** The period: 'YYYY-MM' (`year`), the first day of the block (`month`) or the day (`week`), as in the Progress chart. */
  key: string;
  /** The users on the Free plan at the end of the period (the moment of the request for the current one). */
  free: number;
  premium: number;
}

const startOfDay = (day: string) => new Date(`${day}T00:00:00+07:00`);

/** The first day after the period `key` stands for in `range`. */
const dayAfter = (range: ChartRange, key: string) => {
  if (range === 'year') return `${addMonthsToKey(key, 1)}-01`;
  if (range === 'week') return addDays(key, 1);
  const nextBlock = addDays(key, WEEK_DAYS);
  const nextMonth = `${addMonthsToKey(key.slice(0, 7), 1)}-01`;
  return nextBlock < nextMonth ? nextBlock : nextMonth;
};

/** The users on a live Premium term at `moment` (a user counts once however many terms they have). */
const countPremium = async (moment: Date) => {
  const [row] = await SubscriptionModel.aggregate<{ users: number }>([
    {
      $match: {
        plan: 'premium',
        startsAt: { $lte: moment },
        $or: [{ endedAt: { $gt: moment } }, { endedAt: null, expiresAt: { $gt: moment } }]
      }
    },
    { $group: { _id: '$user' } },
    { $count: 'users' }
  ]);
  return row?.users ?? 0;
};

/**
 * The points of the chart: at the end of each period, every account that existed then is on Free or on Premium. Periods that have not started are left out,
 * and the current one is counted as of now. `date` (a day) picks the year, month or week as in the Progress chart; without it the range ends today.
 */
export const getPlanUsersOverTime = async (range: ChartRange, date?: string, now = new Date()): Promise<PlanUsersPoint[]> => {
  const today = localDateKey(now, ADMIN_ZONE);
  const keys = chartKeys(range, today, date).filter((key) => (key.length === 7 ? `${key}-01` : key) <= today);
  return Promise.all(
    keys.map(async (key) => {
      const end = startOfDay(dayAfter(range, key));
      const moment = end.getTime() > now.getTime() ? now : end;
      const [accounts, premium] = await Promise.all([UserModel.countDocuments({ createdAt: { $lte: moment } }), countPremium(moment)]);
      return { key, free: Math.max(0, accounts - premium), premium };
    })
  );
};
