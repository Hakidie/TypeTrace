// The learner's WPM and accuracy over time (SCRUM-240): the points of the line chart on the profile, by month (a year), by week of
// the current month (a month) or by day (a week).
import { TypingSessionModel } from '../models/typing-session.model';
import { UserModel } from '../models/user.model';
import { notFound } from '../utils/app-error';
import { addDays, localDateKey } from '../utils/local-date';
import { sessionsIn, type TypingLanguage } from '../utils/typing-language';
import { usableTimeZone } from './daily-progress.service';

/**
 * What one point of the chart covers: `year` = the last 12 months, one point a month, up to the current month; `month` = the
 * current month in blocks of 7 days (days 1-7, 8-14, ...: 4 or 5 points, the blocks not started yet are left out); `week` =
 * the last 7 days, one point a day, ending today.
 */
export const CHART_RANGES = ['year', 'month', 'week'] as const;
export type ChartRange = (typeof CHART_RANGES)[number];

/** How many months the `year` range shows; the last one is the current month. */
export const MONTHLY_PROGRESS_MONTHS = 12;
/** How many days the `week` range shows, and how many days a point of the `month` range covers. */
export const WEEK_DAYS = 7;

export interface ProgressPoint {
  /** The period the point covers: 'YYYY-MM' (`year`), the first day of the block 'YYYY-MM-DD' (`month`) or the day 'YYYY-MM-DD' (`week`), in the learner's time zone. */
  key: string;
  /** The average WPM of the period's counted sessions; `null` before the first counted placement session. */
  avgWpm: number | null;
  /** The average accuracy (0-100) of the period's counted sessions; `null` where `avgWpm` is. */
  avgAccuracy: number | null;
  /** True when the period has no counted session and the figures are the ones of the period before. */
  carriedOver: boolean;
}

type Figures = Pick<ProgressPoint, 'avgWpm' | 'avgAccuracy'>;

/** What the counted sessions of one local day add up to. */
export interface DayTotals {
  /** The WPM of the day's sessions added up, and how many sessions had one: the average of a period is the sum over the count. */
  wpmSum: number;
  wpmCount: number;
  /** The accuracy of the day's sessions added up, and how many sessions had one. */
  accuracySum: number;
  accuracyCount: number;
}

const round1 = (value: number) => Math.round(value * 10) / 10;
const pad2 = (value: number) => String(value).padStart(2, '0');

/** The month `count` months after `month` ('YYYY-MM'; before it when negative). Plain arithmetic on the numbers: no time zone, no daylight saving. */
export const addMonths = (month: string, count: number) => {
  const [year, number] = month.split('-').map(Number);
  const index = year * 12 + (number - 1) + count;
  return `${Math.floor(index / 12)}-${pad2((index % 12) + 1)}`;
};

const daysInMonth = (month: string) => {
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number, 0)).getUTCDate();
};

/** The key of the point of `range` that the day `day` ('YYYY-MM-DD') belongs to. */
export const keyOfDay = (range: ChartRange, day: string) => {
  if (range === 'year') return day.slice(0, 7);
  if (range === 'week') return day;
  const blockStart = Math.floor((Number(day.slice(8, 10)) - 1) / WEEK_DAYS) * WEEK_DAYS + 1;
  return `${day.slice(0, 8)}${pad2(blockStart)}`;
};

/** The first day ('YYYY-MM-DD') of the period a key stands for: a point whose first day is after today has not started. */
export const firstDayOf = (key: string) => (key.length === 7 ? `${key}-01` : key);

/**
 * The keys of the points of `range`, oldest first, as of `today` ('YYYY-MM-DD' in the learner's zone). Without `date` the range
 * ends now: the last 12 months, this month, the last 7 days. With `date` ('YYYY-MM-DD', a day in the learner's zone) it is the
 * calendar period that holds the day: its year (January to December), its month, or its week, counted from the 1st of the month (days 1-7, 8-14, ...; the last one has the days left of the month).
 */
export const chartKeys = (range: ChartRange, today: string, date?: string) => {
  if (range === 'year') {
    if (date) return Array.from({ length: MONTHLY_PROGRESS_MONTHS }, (_, index) => `${date.slice(0, 4)}-${pad2(index + 1)}`);
    const last = today.slice(0, 7);
    return Array.from({ length: MONTHLY_PROGRESS_MONTHS }, (_, index) => addMonths(last, index - (MONTHLY_PROGRESS_MONTHS - 1)));
  }
  if (range === 'week') {
    if (date) {
      const start = Math.floor((Number(date.slice(8, 10)) - 1) / WEEK_DAYS) * WEEK_DAYS + 1;
      const length = Math.min(WEEK_DAYS, daysInMonth(date.slice(0, 7)) - start + 1);
      return Array.from({ length }, (_, index) => `${date.slice(0, 8)}${pad2(start + index)}`);
    }
    return Array.from({ length: WEEK_DAYS }, (_, index) => addDays(today, index - (WEEK_DAYS - 1)));
  }
  const month = (date ?? today).slice(0, 7);
  const blocks = Math.ceil(daysInMonth(month) / WEEK_DAYS);
  return Array.from({ length: blocks }, (_, index) => `${month}-${pad2(index * WEEK_DAYS + 1)}`);
};

/**
 * The points of the chart (a pure function). `keys` = the keys of the points, oldest first. `startKey` = the key of the period of
 * the learner's first counted placement session (`null` when they have none): the periods before it have no figures. `figures` =
 * the periods with counted sessions. A period from `startKey` on that has started, without sessions, keeps the figures of the
 * latest period before it that has some, even one before the chart, and is marked `carriedOver`. A period that has not started
 * (the months after this one, the days after today) is left out.
 */
export const buildPoints = (
  keys: readonly string[],
  startKey: string | null,
  figures: ReadonlyMap<string, Figures>,
  today: string
): ProgressPoint[] => {
  let last: Figures | null = null;
  if (startKey) {
    // The latest period before the chart that has figures (the start period itself always does).
    const before = [...figures.keys()].filter((key) => key >= startKey && key < keys[0]).sort();
    const latest = before[before.length - 1];
    if (latest) last = figures.get(latest)!;
  }

  // A period that has not started is left out: the chart shows no column for time that has not come.
  return keys.filter((key) => firstDayOf(key) <= today).map((key) => {
    const none = { key, avgWpm: null, avgAccuracy: null, carriedOver: false };
    if (!startKey || key < startKey) return none;
    const own = figures.get(key);
    if (own) {
      last = own;
      return { key, ...own, carriedOver: false };
    }
    return last ? { key, ...last, carriedOver: true } : none;
  });
};

/** The figures of each period of `range` from the totals of the days (a period before `startKey` is left out). */
export const figuresByKey = (range: ChartRange, days: ReadonlyMap<string, DayTotals>, startKey: string) => {
  const sums = new Map<string, DayTotals>();
  for (const [day, totals] of days) {
    const key = keyOfDay(range, day);
    if (key < startKey) continue;
    const sum = sums.get(key) ?? { wpmSum: 0, wpmCount: 0, accuracySum: 0, accuracyCount: 0 };
    sum.wpmSum += totals.wpmSum;
    sum.wpmCount += totals.wpmCount;
    sum.accuracySum += totals.accuracySum;
    sum.accuracyCount += totals.accuracyCount;
    sums.set(key, sum);
  }
  return new Map<string, Figures>(
    [...sums].map(([key, sum]) => [
      key,
      {
        avgWpm: sum.wpmCount ? round1(sum.wpmSum / sum.wpmCount) : null,
        avgAccuracy: sum.accuracyCount ? round1(sum.accuracySum / sum.accuracyCount) : null
      }
    ])
  );
};

/**
 * The name of the zone as MongoDB wants it. `Intl` takes a name in any letter case (`asia/saigon`), MongoDB does not, so the
 * canonical name comes from `Intl` itself.
 */
export const mongoTimeZone = (timeZone: string) => new Intl.DateTimeFormat('en-US', { timeZone }).resolvedOptions().timeZone;

/**
 * `GET /api/profile/monthly-progress?range=year|month|week&date=&language=`: the average WPM and accuracy of each point of
 * the range, cut in the learner's time zone, of their counted sessions in one typing language (SCRUM-219: their Practice
 * language when missing; WPM of Vietnamese and English do not mix). Vietnamese figures start in the period of the learner's
 * first counted placement session (every counted Vietnamese session counts from then on, whatever its mode); English ones,
 * which have no placement test, in the period of their first counted English session. The token of a deleted account passes
 * `authGuard`: it answers 404, like the other profile endpoints.
 */
export const getMonthlyProgress = async (userId: string, range: ChartRange = 'year', date?: string, language?: TypingLanguage) => {
  const user = await UserModel.findById(userId).select('settings.timezone settings.typingLanguage').lean();
  if (!user) throw notFound('User not found');
  const shown = language ?? user.settings?.typingLanguage ?? 'vi';
  const timeZone = usableTimeZone(user.settings?.timezone);
  const today = localDateKey(new Date(), timeZone);
  const keys = chartKeys(range, today, date);

  const first = await TypingSessionModel.findOne({
    owner: userId,
    isCounted: true,
    ...(shown === 'vi' ? { mode: 'placement' } : {}),
    ...sessionsIn(shown)
  })
    .sort({ completedAt: 1 })
    .select('completedAt')
    .lean();
  if (!first?.completedAt) return { range, language: shown, points: buildPoints(keys, null, new Map(), today) };
  const startKey = keyOfDay(range, localDateKey(first.completedAt, timeZone));

  // One row per local day with counted sessions: the periods are built from them, a block of days or a month is not a group of its own.
  const rows = await TypingSessionModel.aggregate<DayTotals & { _id: string }>([
    { $match: { owner: user._id, isCounted: true, completedAt: { $exists: true }, ...sessionsIn(shown) } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt', timezone: mongoTimeZone(timeZone) } },
        wpmSum: { $sum: '$wpm' },
        wpmCount: { $sum: { $cond: [{ $gt: ['$wpm', null] }, 1, 0] } },
        accuracySum: { $sum: '$accuracy' },
        accuracyCount: { $sum: { $cond: [{ $gt: ['$accuracy', null] }, 1, 0] } }
      }
    }
  ]);

  const days = new Map<string, DayTotals>(rows.map((row) => [row._id, row]));
  return { range, language: shown, points: buildPoints(keys, startKey, figuresByKey(range, days, startKey), today) };
};
