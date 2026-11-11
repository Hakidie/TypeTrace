import { describe, expect, it } from 'vitest';
import type { ErrorCounts } from '../../src/models/typing-session.model';
import {
  computeErrorProfile,
  type ErrorProfile,
  levelOf,
  MIN_PROFILE_OPPORTUNITIES,
  PROFILE_WINDOW,
  type ProfileSession,
  trendOf,
  WEAK_RATE
} from '../../src/services/error-profile.service';
import { WordError, type WordErrorType } from '../../src/utils/vietnamese-errors';

/** A session with `[errors, chances]` of the types given, none of the others. */
const session = (counts: Partial<Record<WordErrorType, readonly [number, number]>> = {}): ProfileSession => {
  const errorCounts: Partial<ErrorCounts> = {};
  const opportunityCounts: Partial<ErrorCounts> = {};
  for (const [type, [errors, chances]] of Object.entries(counts) as [WordErrorType, [number, number]][]) {
    errorCounts[type] = errors;
    opportunityCounts[type] = chances;
  }
  return { errorCounts, opportunityCounts };
};

/** `count` sessions alike. */
const times = (count: number, made: ProfileSession) => Array.from({ length: count }, () => made);

const typeOf = (profile: ErrorProfile, type: WordErrorType) => profile.types.find((item) => item.type === type)!;

describe('levelOf', () => {
  it('has no level under MIN_PROFILE_OPPORTUNITIES chances, even with errors', () => {
    expect(levelOf({ errors: 19, opportunities: MIN_PROFILE_OPPORTUNITIES - 1 })).toBe('insufficient_data');
    expect(levelOf({ errors: 0, opportunities: MIN_PROFILE_OPPORTUNITIES - 1 })).toBe('insufficient_data');
    expect(levelOf({ errors: 0, opportunities: MIN_PROFILE_OPPORTUNITIES })).toBe('ok');
  });

  it('is weak from exactly WEAK_RATE % on', () => {
    expect(WEAK_RATE).toBe(15);
    expect(levelOf({ errors: 6, opportunities: 40 })).toBe('weak'); // 15 %
    expect(levelOf({ errors: 3, opportunities: 20 })).toBe('weak'); // 15 %
    expect(levelOf({ errors: 5, opportunities: 40 })).toBe('ok'); // 12.5 %
    expect(levelOf({ errors: 14, opportunities: 94 })).toBe('ok'); // 14.9 %
  });
});

describe('trendOf', () => {
  it('is improved or worse when the rate moved more than chance would move it', () => {
    expect(trendOf({ errors: 6, opportunities: 40 }, { errors: 14, opportunities: 40 })).toBe('improved'); // 35 % → 15 %, z ≈ -2.07
    expect(trendOf({ errors: 14, opportunities: 40 }, { errors: 6, opportunities: 40 })).toBe('worse');
  });

  it('weighs the change by the chances: the same drop is a trend on many chances and noise on a few', () => {
    expect(trendOf({ errors: 12, opportunities: 400 }, { errors: 24, opportunities: 400 })).toBe('improved'); // 6 % → 3 %, z ≈ -2.05
    expect(trendOf({ errors: 6, opportunities: 30 }, { errors: 9, opportunities: 30 })).toBe('unchanged'); // 30 % → 20 %, z ≈ -0.89
    expect(trendOf({ errors: 9, opportunities: 30 }, { errors: 6, opportunities: 30 })).toBe('unchanged');
  });

  it('has no trend while either window has fewer than MIN_PROFILE_OPPORTUNITIES chances', () => {
    const few = MIN_PROFILE_OPPORTUNITIES - 1;
    expect(trendOf({ errors: 0, opportunities: 40 }, { errors: few, opportunities: few })).toBe('insufficient_data');
    expect(trendOf({ errors: few, opportunities: few }, { errors: 0, opportunities: 40 })).toBe('insufficient_data');
  });

  it('is unchanged when there is nothing to compare: no error at all, or more errors than chances', () => {
    expect(trendOf({ errors: 0, opportunities: 40 }, { errors: 0, opportunities: 40 })).toBe('unchanged');
    expect(trendOf({ errors: 30, opportunities: 20 }, { errors: 25, opportunities: 20 })).toBe('unchanged');
  });
});

describe('computeErrorProfile', () => {
  it('gives a learner without a session every type without data, with the thresholds', () => {
    expect(computeErrorProfile([])).toEqual({
      window: PROFILE_WINDOW,
      minOpportunities: MIN_PROFILE_OPPORTUNITIES,
      weakRate: WEAK_RATE,
      sessionsUsed: 0,
      types: Object.values(WordError).map((type) => ({
        type,
        errors: 0,
        opportunities: 0,
        rate: 0,
        level: 'insufficient_data',
        previousRate: 0,
        trend: 'insufficient_data'
      })),
      weakTypes: [],
      rankedTypes: []
    });
  });

  it('adds up the 10 newest sessions and the 10 before them, and leaves the older ones out', () => {
    const sessions = [
      ...times(PROFILE_WINDOW, session({ HOI_NGA_CONFUSION: [1, 4] })), // 10 / 40 = 25 %
      ...times(PROFILE_WINDOW, session({ HOI_NGA_CONFUSION: [2, 4] })), // 20 / 40 = 50 %
      ...times(5, session({ HOI_NGA_CONFUSION: [4, 4] }))
    ];

    const profile = computeErrorProfile(sessions);

    expect(profile.sessionsUsed).toBe(PROFILE_WINDOW);
    expect(typeOf(profile, 'HOI_NGA_CONFUSION')).toEqual({
      type: 'HOI_NGA_CONFUSION',
      errors: 10,
      opportunities: 40,
      rate: 25,
      level: 'weak',
      previousRate: 50,
      trend: 'improved'
    });
    expect(profile.weakTypes).toEqual(['HOI_NGA_CONFUSION']);
  });

  it('works with fewer sessions than a window', () => {
    const profile = computeErrorProfile(times(3, session({ BASE_LETTER: [1, 10] })));

    expect(profile.sessionsUsed).toBe(3);
    expect(typeOf(profile, 'BASE_LETTER')).toMatchObject({ errors: 3, opportunities: 30, rate: 10, level: 'ok', trend: 'insufficient_data' });
  });

  it('gives the rate in % with one decimal, 0 without a chance and at most 100', () => {
    const profile = computeErrorProfile([session({ TONE_WRONG: [1, 3], MARK_WRONG: [30, 20] })]);

    expect(typeOf(profile, 'TONE_WRONG')).toMatchObject({ rate: 33.3, level: 'insufficient_data' });
    expect(typeOf(profile, 'D_MISSING')).toMatchObject({ errors: 0, opportunities: 0, rate: 0 });
    // A vowel mark typed on words without one: more errors than chances.
    expect(typeOf(profile, 'MARK_WRONG')).toMatchObject({ rate: 100, level: 'weak' });
  });

  it('counts a missing count as 0', () => {
    const profile = computeErrorProfile([{ opportunityCounts: { BASE_LETTER: 30 } }, {}]);

    expect(profile.sessionsUsed).toBe(2);
    expect(typeOf(profile, 'BASE_LETTER')).toMatchObject({ errors: 0, opportunities: 30, rate: 0, level: 'ok' });
  });

  it('ranks the weak types by error rate, then by errors, then in the order of WordError', () => {
    const profile = computeErrorProfile([
      session({
        HOI_NGA_CONFUSION: [10, 40], // 25 %
        BASE_LETTER: [16, 80], // 20 %, 16 errors
        TONE_WRONG: [8, 40], // 20 %, 8 errors
        MARK_WRONG: [4, 20], // 20 %, 4 errors
        D_MISSING: [4, 20] // 20 %, 4 errors, before MARK_WRONG in WordError
      })
    ]);

    expect(profile.weakTypes).toEqual(['HOI_NGA_CONFUSION', 'BASE_LETTER', 'TONE_WRONG', 'D_MISSING', 'MARK_WRONG']);
  });

  it('keeps the types that are ok or without data out of the weak types', () => {
    const profile = computeErrorProfile([session({ HOI_NGA_CONFUSION: [5, 40], D_MISSING: [5, 10] })]);

    expect(typeOf(profile, 'HOI_NGA_CONFUSION').level).toBe('ok');
    expect(typeOf(profile, 'D_MISSING').level).toBe('insufficient_data');
    expect(profile.weakTypes).toEqual([]);
    // Ok but with enough data: a Weak spots lesson still aims at it.
    expect(profile.rankedTypes).toEqual(['HOI_NGA_CONFUSION']);
  });

  it('ranks every type with enough data, weak or ok, by error rate, and leaves out the types without data', () => {
    const profile = computeErrorProfile([
      session({
        TONE_WRONG: [2, 40], // 5 %, ok
        HOI_NGA_CONFUSION: [8, 40], // 20 %, weak
        BASE_LETTER: [0, 80], // 0 %, ok
        MARK_WRONG: [3, 30], // 10 %, ok
        D_MISSING: [5, 10] // 50 %, but too few chances for a level
      })
    ]);

    expect(profile.weakTypes).toEqual(['HOI_NGA_CONFUSION']);
    expect(profile.rankedTypes).toEqual(['HOI_NGA_CONFUSION', 'MARK_WRONG', 'TONE_WRONG', 'BASE_LETTER']);
  });

  it('breaks a tie of the ranked types by errors, then by the order of WordError, as the weak ones', () => {
    const profile = computeErrorProfile([
      session({
        HOI_NGA_CONFUSION: [2, 40], // 5 %, 2 errors
        BASE_LETTER: [4, 80], // 5 %, 4 errors
        TONE_WRONG: [0, 40], // 0 %
        D_MISSING: [0, 20] // 0 %, before TONE_WRONG in WordError
      })
    ]);

    expect(profile.rankedTypes).toEqual(['BASE_LETTER', 'HOI_NGA_CONFUSION', 'D_MISSING', 'TONE_WRONG']);
  });
});
