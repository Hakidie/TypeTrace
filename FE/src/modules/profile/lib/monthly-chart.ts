import type { ChartRange, MonthlyProgressPoint } from '../types/profile.types';

/**
 * The points the chart draws (SCRUM-240): from the period of the learner's first counted placement session on (the periods
 * before it have no figures). The API leaves out the periods that have not started, so there is no column for time that has not come. All the points while there is no data at all.
 */
export const chartPoints = (points: MonthlyProgressPoint[]) => {
  const first = points.findIndex((point) => point.avgWpm !== null);
  return first === -1 ? points : points.slice(first);
};

/** The points of a chart of one period: a week shows all its days (also those before the first placement), a year or a month starts at the first placement (`chartPoints`). */
export const shownPoints = (range: ChartRange, points: MonthlyProgressPoint[]) => (range === 'week' ? points : chartPoints(points));

/**
 * The scale of one line of the chart: from the lowest value of that line to its highest, so the Y axis starts at the line's own
 * lowest value (the line itself need not start there). A line that does not move gets 1 more above, so it runs along the bottom.
 * Without values the scale is 0-1 (the flat line of an empty chart).
 */
export const lineDomain = (values: (number | null)[]): [number, number] => {
  const known = values.filter((value): value is number => value !== null);
  if (known.length === 0) return [0, 1];
  const low = Math.min(...known);
  return [low, Math.max(low + 1, ...known)];
};

/** One column of a chart with periods put on it: the point of the chart's own period and of each period added, at the same place (the same month, week or day of it), `null` where one has none. */
export interface CompareColumn {
  main: MonthlyProgressPoint | null;
  others: (MonthlyProgressPoint | null)[];
}

/** The columns of the periods side by side, by position; the longest period decides how many (a year so far has fewer months than a whole one). */
export const compareColumns = (main: MonthlyProgressPoint[], others: MonthlyProgressPoint[][]): CompareColumn[] =>
  Array.from({ length: Math.max(main.length, ...others.map((points) => points.length)) }, (_, index) => ({
    main: main[index] ?? null,
    others: others.map((points) => points[index] ?? null),
  }));

/** The periods put on the chart have the same lines as its own period, fainter and fainter (no more accent colors); this many at most. */
export const COMPARE_OPACITIES = [0.6, 0.4, 0.25];
