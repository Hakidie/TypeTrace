import { describe, expect, it } from 'vitest';
import { anchorFor, periodLabel, periodOptions, periodValue, weekStartOf } from './chart-period';

const TODAY = '2026-03-10'; // a Tuesday

describe('chart periods', () => {
  it('counts the weeks from the 1st of the month', () => {
    expect(weekStartOf('2026-03-01')).toBe('2026-03-01');
    expect(weekStartOf('2026-03-07')).toBe('2026-03-01');
    expect(weekStartOf('2026-03-10')).toBe('2026-03-08');
    expect(weekStartOf('2026-03-31')).toBe('2026-03-29');
  });

  it('names the period of a day in each range without the larger one', () => {
    expect(periodLabel('year', '2026-10-10')).toBe('2026');
    expect(periodLabel('month', '2026-10-10')).toBe('October');
    expect(periodLabel('week', '2026-10-10')).toBe('Week 2');
    expect(periodLabel('week', '2026-10-31')).toBe('Week 5');
    expect(periodValue('week', '2026-03-10')).toBe('2026-03-08');
  });

  it('offers the last 5 years, the months so far of the year and the weeks so far of the month', () => {
    expect(periodOptions('year', TODAY, TODAY).map((option) => option.value)).toEqual(['2022', '2023', '2024', '2025', '2026']);
    expect(periodOptions('month', TODAY, TODAY).map((option) => option.label)).toEqual(['January', 'February', 'March']);
    expect(periodOptions('month', '2025-06-15', TODAY)).toHaveLength(12);
    expect(periodOptions('week', TODAY, TODAY)).toEqual([
      { value: '2026-03-01', label: 'Week 1' },
      { value: '2026-03-08', label: 'Week 2' },
    ]);
    expect(periodOptions('week', '2026-02-12', TODAY).map((option) => option.label)).toEqual(['Week 1', 'Week 2', 'Week 3', 'Week 4']);
    expect(periodOptions('week', '2026-01-12', TODAY)).toHaveLength(5);
  });

  it('turns a pick into the day to ask for, never after today', () => {
    expect(anchorFor('year', '2025', '2026-03-10', TODAY)).toBe('2025-03-10');
    expect(anchorFor('year', '2026', '2025-12-20', TODAY)).toBe(TODAY);
    expect(anchorFor('year', '2025', '2024-02-29', TODAY)).toBe('2025-02-28');
    expect(anchorFor('month', '2026-02', '2026-03-10', TODAY)).toBe('2026-02-01');
    expect(anchorFor('week', '2026-03-08', '2026-03-10', TODAY)).toBe('2026-03-08');
  });
});
