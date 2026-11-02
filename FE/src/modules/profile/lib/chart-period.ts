import type { ChartRange } from '../types/profile.types';

/** The years offered by the Year menu: this year and the four before it. */
const YEARS_SHOWN = 5;

export interface PeriodOption {
  /** What `anchorFor` takes: '2026' (a year), '2026-03' (a month) or the first day of a week '2026-03-08'. */
  value: string;
  label: string;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEK_DAYS = 7;
const pad2 = (value: number) => String(value).padStart(2, '0');

/** The week of the month that holds `day`, counted from the 1st: days 1-7 are week 1, days 8-14 week 2, ... */
const weekNumber = (day: string) => Math.floor((Number(day.slice(8, 10)) - 1) / WEEK_DAYS) + 1;

/** The first day of the week that holds `day` ('2026-03-10' → '2026-03-08'). */
export const weekStartOf = (day: string) => `${day.slice(0, 8)}${pad2((weekNumber(day) - 1) * WEEK_DAYS + 1)}`;

/** What the value of `anchor` is in `range`: '2026' (Year), '2026-03' (Month) or the first day of its week (Week). */
export const periodValue = (range: ChartRange, anchor: string) =>
  range === 'year' ? anchor.slice(0, 4) : range === 'month' ? anchor.slice(0, 7) : weekStartOf(anchor);

/** The name of a period without the larger one: '2026', 'October', 'Week 2' (the Year button says the year). */
export const periodLabel = (range: ChartRange, anchor: string) =>
  range === 'year' ? anchor.slice(0, 4) : range === 'month' ? MONTH_NAMES[Number(anchor.slice(5, 7)) - 1] : `Week ${weekNumber(anchor)}`;

/**
 * The periods a learner can pick, newest last, none after `today`: the last years (Year), the months of the year of `anchor`
 * (Month), or the weeks of the month of `anchor`, counted from its 1st (Week).
 */
export const periodOptions = (range: ChartRange, anchor: string, today: string): PeriodOption[] => {
  if (range === 'year') {
    const last = Number(today.slice(0, 4));
    return Array.from({ length: YEARS_SHOWN }, (_, index) => String(last - (YEARS_SHOWN - 1) + index)).map((year) => ({ value: year, label: year }));
  }
  if (range === 'month') {
    return MONTH_NAMES.map((name, index) => ({ value: `${anchor.slice(0, 4)}-${pad2(index + 1)}`, label: name })).filter((option) => `${option.value}-01` <= today);
  }
  const month = anchor.slice(0, 7);
  const last = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const weeks: PeriodOption[] = [];
  for (let day = 1; day <= last && `${month}-${pad2(day)}` <= today; day += WEEK_DAYS) {
    weeks.push({ value: `${month}-${pad2(day)}`, label: `Week ${weeks.length + 1}` });
  }
  return weeks;
};

/**
 * The day to ask the API for after the learner picks `value` in `range`, never after `today`. A year or a month keeps the
 * rest of the day it replaces (so Year → Month stays in the same month where it can); a week is its first day.
 */
export const anchorFor = (range: ChartRange, value: string, anchor: string, today: string) => {
  let day: string;
  if (range === 'week') day = value;
  else if (range === 'month') day = `${value}-01`;
  else {
    day = `${value}${anchor.slice(4)}`;
    // 29 February in a year without one.
    if (new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day) day = `${value}-${anchor.slice(5, 7)}-28`;
  }
  return day > today ? today : day;
};

/** A period with the larger one it belongs to, for the comparison: '2025', 'October 2025', 'Week 2 October 2025'. */
export const compareLabel = (range: ChartRange, anchor: string) => {
  const month = MONTH_NAMES[Number(anchor.slice(5, 7)) - 1];
  return range === 'year' ? anchor.slice(0, 4) : range === 'month' ? `${month} ${anchor.slice(0, 4)}` : `Week ${weekNumber(anchor)} ${month} ${anchor.slice(0, 4)}`;
};

/** The first day of the month before the one that holds `day` ('2026-03-10' → '2026-02-01', '2026-01-05' → '2025-12-01'). */
export const previousMonthStart = (day: string) => {
  const index = Number(day.slice(0, 4)) * 12 + Number(day.slice(5, 7)) - 2;
  return `${Math.floor(index / 12)}-${pad2((index % 12) + 1)}-01`;
};
