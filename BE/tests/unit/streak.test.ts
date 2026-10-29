import { describe, expect, it } from 'vitest';
import { computeStreak } from '../../src/services/daily-progress.service';

const TODAY = '2026-10-27';

describe('computeStreak', () => {
  it('is 0 without any day', () => {
    expect(computeStreak([], TODAY)).toEqual({ current: 0, longest: 0 });
  });

  it('counts today alone as one day', () => {
    expect(computeStreak([TODAY], TODAY)).toEqual({ current: 1, longest: 1 });
  });

  it('counts the days in a row ending today', () => {
    expect(computeStreak(['2026-10-25', '2026-10-26', TODAY], TODAY)).toEqual({ current: 3, longest: 3 });
  });

  it('keeps the streak alive until the end of today when the last day is yesterday', () => {
    expect(computeStreak(['2026-10-26'], TODAY)).toEqual({ current: 1, longest: 1 });
    expect(computeStreak(['2026-10-24', '2026-10-25', '2026-10-26'], TODAY)).toEqual({ current: 3, longest: 3 });
  });

  it('breaks the streak when the last day was two days ago, but keeps it as the longest', () => {
    expect(computeStreak(['2026-10-24', '2026-10-25'], TODAY)).toEqual({ current: 0, longest: 2 });
  });

  it('stops the current streak at the first day without a session', () => {
    expect(computeStreak(['2026-10-23', '2026-10-24', '2026-10-26', TODAY], TODAY)).toEqual({ current: 2, longest: 2 });
  });

  it('keeps a longer run from earlier in the history as the longest', () => {
    const september = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'];
    expect(computeStreak([...september, '2026-10-26', TODAY], TODAY)).toEqual({ current: 2, longest: 5 });
  });

  it('runs across a month end, a year end and 29 February', () => {
    expect(computeStreak(['2026-09-29', '2026-09-30', '2026-10-01'], '2026-10-01')).toEqual({ current: 3, longest: 3 });
    expect(computeStreak(['2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02'], '2026-01-02')).toEqual({ current: 4, longest: 4 });
    expect(computeStreak(['2028-02-28', '2028-02-29', '2028-03-01'], '2028-03-01')).toEqual({ current: 3, longest: 3 });
    // 2028 has a 29 February: without it the run is broken.
    expect(computeStreak(['2028-02-27', '2028-02-28', '2028-03-01'], '2028-03-01')).toEqual({ current: 1, longest: 2 });
  });

  it('accepts the days in any order and the same day more than once', () => {
    expect(computeStreak([TODAY, '2026-10-25', '2026-10-26', '2026-10-25', TODAY], TODAY)).toEqual({ current: 3, longest: 3 });
  });

  it('does not let a day after today break the current streak (a learner who moved to a zone further west)', () => {
    expect(computeStreak(['2026-10-26', TODAY, '2026-10-28'], TODAY)).toEqual({ current: 2, longest: 3 });
  });
});
