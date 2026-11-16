import { i18n } from '@/shared/i18n/i18n';
import { monthShort } from '@/shared/lib/local-date';
import type { ChartRange } from '../types/profile.types';


/** 'YYYY-MM' (or the start of a period 'YYYY-MM-DD') → 'JAN', 'FEB', ... */
export const shortMonth = (key: string) => i18n.t(`profile:period.monthShort.${Number(key.slice(5, 7))}`);

/** The week of the month a block starts: '2026-03-08' → 2 (blocks of 7 days: days 1-7, 8-14, ...). */
const blockNumber = (key: string) => Math.floor((Number(key.slice(8, 10)) - 1) / 7) + 1;

/** 'YYYY-MM-DD' → 'MON', 'TUE', ... (the date is read as a date only: no time zone moves it). */
const dayName = (key: string) => i18n.t(`profile:period.dayShort.${new Date(`${key}T00:00:00Z`).getUTCDay()}`);

/** The month in a tooltip: `Nov`, or `Thg 11` (the axis uses the capitals `NOV`, `T11`). */
const tooltipMonth = (key: string) => monthShort(Number(key.slice(5, 7))).toUpperCase();

/** The name of a point under the chart: 'JAN' (a year), 'W2' (a month), 'MON' (a week). */
export const axisLabel = (range: ChartRange, key: string) =>
  range === 'year' ? shortMonth(key) : range === 'month' ? i18n.t('profile:period.block', { n: blockNumber(key) }) : dayName(key);

/** The title of the tooltip of a point: 'JAN 2026' (a year), 'W2 MAR 2026' (a month), 'MON 09 MAR' (a week). */
export const tooltipTitle = (range: ChartRange, key: string) =>
  range === 'year'
    ? `${tooltipMonth(key)} ${key.slice(0, 4)}`
    : range === 'month'
      ? `${i18n.t('profile:period.block', { n: blockNumber(key) })} ${tooltipMonth(key)} ${key.slice(0, 4)}`
      : `${dayName(key)} ${key.slice(8, 10)} ${tooltipMonth(key)}`;

/** What the figures of a point without a session are the ones of. */
export const previousPeriod = (range: ChartRange) => i18n.t(`profile:chart.previous.${range}`);

/** What the range is called in the name of the chart for screen readers. */
export const rangeUnit = previousPeriod;
