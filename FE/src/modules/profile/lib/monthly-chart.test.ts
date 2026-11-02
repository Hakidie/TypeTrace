import { describe, expect, it } from 'vitest';
import type { MonthlyProgressPoint } from '../types/profile.types';
import { axisLabel, tooltipTitle } from './month-label';
import { chartPoints, compareColumns, lineDomain } from './monthly-chart';

const empty = (key: string): MonthlyProgressPoint => ({ key, avgWpm: null, avgAccuracy: null, carriedOver: false });
const real = (key: string, carriedOver = false): MonthlyProgressPoint => ({ key, avgWpm: 40, avgAccuracy: 95, carriedOver });

describe('chartPoints (SCRUM-240)', () => {
  it('starts at the period of the first placement: placement in August, today in October, gives AUG, SEP, OCT', () => {
    const points = [empty('2025-06'), empty('2025-07'), real('2025-08'), real('2025-09', true), real('2025-10', true)];

    expect(chartPoints(points).map((point) => point.key)).toEqual(['2025-08', '2025-09', '2025-10']);
  });

  it('keeps all points when the first placement is at the start of the chart or before it', () => {
    const points = [real('2025-03'), real('2025-04', true), real('2025-05')];

    expect(chartPoints(points)).toEqual(points);
  });

  it('keeps the empty points after the first one (the API leaves out the periods that have not started)', () => {
    const points = [empty('2026-03-01'), real('2026-03-08'), empty('2026-03-15'), empty('2026-03-22')];

    expect(chartPoints(points).map((point) => point.key)).toEqual(['2026-03-08', '2026-03-15', '2026-03-22']);
  });

  it('draws a single point when the placement is in the current period', () => {
    expect(chartPoints([empty('2025-08'), empty('2025-09'), real('2025-10')]).map((point) => point.key)).toEqual(['2025-10']);
  });

  it('keeps every point while there is no data', () => {
    const points = ['2025-03', '2025-04', '2025-05'].map(empty);

    expect(chartPoints(points)).toEqual(points);
  });
});

describe('labels of the chart', () => {
  it('names the points of a year by month, of a month by week and of a week by day', () => {
    expect(axisLabel('year', '2026-01')).toBe('JAN');
    expect(axisLabel('year', '2025-12')).toBe('DEC');
    expect(['2026-03-01', '2026-03-08', '2026-03-15', '2026-03-22', '2026-03-29'].map((key) => axisLabel('month', key))).toEqual(['W1', 'W2', 'W3', 'W4', 'W5']);
    expect(['2026-03-09', '2026-03-10', '2026-03-15'].map((key) => axisLabel('week', key))).toEqual(['MON', 'TUE', 'SUN']);
  });

  it('titles the tooltip of a point with its period', () => {
    expect(tooltipTitle('year', '2026-01')).toBe('JAN 2026');
    expect(tooltipTitle('month', '2026-03-22')).toBe('W4 MAR 2026');
    expect(tooltipTitle('week', '2026-03-09')).toBe('MON 09 MAR');
  });
});

describe('lineDomain', () => {
  it('runs from the lowest value of the line to its highest', () => {
    expect(lineDomain([40, null, 55, 48])).toEqual([40, 55]);
    expect(lineDomain([90, 95, null])).toEqual([90, 95]);
  });

  it('keeps a line that does not move along the bottom, and an empty one at 0-1', () => {
    expect(lineDomain([50, 50])).toEqual([50, 51]);
    expect(lineDomain([])).toEqual([0, 1]);
  });
});

describe('compareColumns', () => {
  it('puts the periods side by side by position, the longest deciding how many columns', () => {
    const columns = compareColumns([real('2026-01'), real('2026-02'), real('2026-03')], [[real('2025-01'), real('2025-02')], [real('2024-01')]]);

    expect(columns.map((column) => [column.main?.key, column.others.map((point) => point?.key)])).toEqual([
      ['2026-01', ['2025-01', '2024-01']],
      ['2026-02', ['2025-02', undefined]],
      ['2026-03', [undefined, undefined]],
    ]);
    expect(columns[2].others).toEqual([null, null]);
  });
});
