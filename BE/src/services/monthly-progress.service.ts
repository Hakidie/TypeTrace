// The learner's WPM and errors by month (SCRUM-240): the 12 months before the current one, for the line chart on the profile.
import { TypingSessionModel } from '../models/typing-session.model';
import { UserModel } from '../models/user.model';
import { notFound } from '../utils/app-error';
import { localDateKey } from '../utils/local-date';
import { WordError } from '../utils/vietnamese-errors';
import { usableTimeZone } from './daily-progress.service';

/** How many months the chart shows; the last one is the month before the current one. */
export const MONTHLY_PROGRESS_MONTHS = 12;

export interface MonthlyProgressPoint {
  /** 'YYYY-MM', in the learner's time zone. */
  month: string;
  /** The average WPM of the month's counted sessions; `null` before the first counted placement session. */
  avgWpm: number | null;
  /** All the errors (the five types) of the month's counted sessions; `null` before the first counted placement session. */
  totalErrors: number | null;
  /** True when the month has no counted session and the figures are the ones of the month before. */
  carriedOver: boolean;
}

type MonthFigures = Pick<MonthlyProgressPoint, 'avgWpm' | 'totalErrors'>;

const round1 = (value: number) => Math.round(value * 10) / 10;

/** The month `count` months after `month` ('YYYY-MM'; before it when negative). Plain arithmetic on the numbers: no time zone, no daylight saving. */
export const addMonths = (month: string, count: number) => {
  const [year, number] = month.split('-').map(Number);
  const index = year * 12 + (number - 1) + count;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
};

/** The `MONTHLY_PROGRESS_MONTHS` months of the chart, oldest first, the last one being the month before `today` ('YYYY-MM-DD'). */
export const chartMonths = (today: string) => {
  const last = addMonths(today.slice(0, 7), -1);
  return Array.from({ length: MONTHLY_PROGRESS_MONTHS }, (_, index) => addMonths(last, index - (MONTHLY_PROGRESS_MONTHS - 1)));
};

/**
 * The points of the chart (a pure function). `months` = the months of the chart, oldest first. `startMonth` = the month of
 * the learner's first counted placement session (`null` when they have none): the months before it have no figures. `figures` =
 * the months with counted sessions. A month from `startMonth` on without sessions keeps the figures of the latest month before
 * it that has some, even one before the chart, and is marked `carriedOver`.
 */
export const buildMonthlyPoints = (
  months: readonly string[],
  startMonth: string | null,
  figures: ReadonlyMap<string, MonthFigures>
): MonthlyProgressPoint[] => {
  let last: MonthFigures | null = null;
  if (startMonth) {
    // The latest month before the chart that has figures (the start month itself always does).
    const before = [...figures.keys()].filter((month) => month >= startMonth && month < months[0]).sort();
    const latest = before[before.length - 1];
    if (latest) last = figures.get(latest)!;
  }

  return months.map((month) => {
    if (!startMonth || month < startMonth) return { month, avgWpm: null, totalErrors: null, carriedOver: false };
    const own = figures.get(month);
    if (own) {
      last = own;
      return { month, ...own, carriedOver: false };
    }
    return last
      ? { month, ...last, carriedOver: true }
      : { month, avgWpm: null, totalErrors: null, carriedOver: false };
  });
};

/**
 * The name of the zone as MongoDB wants it. `Intl` takes a name in any letter case (`asia/saigon`), MongoDB does not, so the
 * canonical name comes from `Intl` itself.
 */
const mongoTimeZone = (timeZone: string) => new Intl.DateTimeFormat('en-US', { timeZone }).resolvedOptions().timeZone;

/**
 * `GET /api/profile/monthly-progress`: the average WPM and the number of errors of each of the 12 months before the current
 * one, cut in the learner's time zone. Only counted sessions. The figures start in the month of the learner's first counted
 * placement session (every counted session counts from then on, whatever its mode). The token of a deleted account passes
 * `authGuard`: it answers 404, like the other profile endpoints.
 */
export const getMonthlyProgress = async (userId: string) => {
  const user = await UserModel.findById(userId).select('settings.timezone').lean();
  if (!user) throw notFound('User not found');
  const timeZone = usableTimeZone(user.settings?.timezone);
  const months = chartMonths(localDateKey(new Date(), timeZone));

  const firstPlacement = await TypingSessionModel.findOne({ owner: userId, mode: 'placement', isCounted: true })
    .sort({ completedAt: 1 })
    .select('completedAt')
    .lean();
  const startMonth = firstPlacement?.completedAt ? localDateKey(firstPlacement.completedAt, timeZone).slice(0, 7) : null;
  if (!startMonth) return { months: buildMonthlyPoints(months, null, new Map()) };

  const rows = await TypingSessionModel.aggregate<{ _id: string; avgWpm: number | null; totalErrors: number }>([
    { $match: { owner: user._id, isCounted: true, completedAt: { $exists: true } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$completedAt', timezone: mongoTimeZone(timeZone) } },
        avgWpm: { $avg: '$wpm' },
        totalErrors: {
          $sum: { $add: Object.values(WordError).map((type) => ({ $ifNull: [`$errorCounts.${type}`, 0] })) }
        }
      }
    }
  ]);

  const figures = new Map<string, MonthFigures>(
    rows.map((row) => [row._id, { avgWpm: row.avgWpm === null ? null : round1(row.avgWpm), totalErrors: row.totalErrors }])
  );
  return { months: buildMonthlyPoints(months, startMonth, figures) };
};
