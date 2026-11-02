import type { MonthlyProgressPoint } from '../types/profile.types';

/**
 * The points the chart draws (SCRUM-240): from the period of the learner's first counted placement session on (the periods
 * before it have no figures). The API leaves out the periods that have not started, so there is no column for time that has not come. All the points while there is no data at all.
 */
export const chartPoints = (points: MonthlyProgressPoint[]) => {
  const first = points.findIndex((point) => point.avgWpm !== null);
  return first === -1 ? points : points.slice(first);
};

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
