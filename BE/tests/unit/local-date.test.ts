import { describe, expect, it, vi } from 'vitest';
import { addDays, isValidTimeZone, localDateKey, MAX_FORMATTERS } from '../../src/utils/local-date';

const dayOf = (instant: string, timeZone: string) => localDateKey(new Date(instant), timeZone);

describe('localDateKey', () => {
  it('starts the day at midnight in Asia/Ho_Chi_Minh (UTC+7), seven hours before midnight UTC', () => {
    expect(dayOf('2026-03-10T16:59:59.999Z', 'Asia/Ho_Chi_Minh')).toBe('2026-03-10');
    expect(dayOf('2026-03-10T17:00:00.000Z', 'Asia/Ho_Chi_Minh')).toBe('2026-03-11');
  });

  it('keeps the UTC day in UTC', () => {
    expect(dayOf('2026-03-10T16:59:59.999Z', 'UTC')).toBe('2026-03-10');
    expect(dayOf('2026-03-10T17:00:00.000Z', 'UTC')).toBe('2026-03-10');
    expect(dayOf('2026-03-10T23:59:59.999Z', 'UTC')).toBe('2026-03-10');
    expect(dayOf('2026-03-11T00:00:00.000Z', 'UTC')).toBe('2026-03-11');
  });

  it('follows the daylight saving change of America/New_York on 8 March 2026 (UTC-5, then UTC-4)', () => {
    // Midnight before the change is 05:00 UTC.
    expect(dayOf('2026-03-08T04:59:59.999Z', 'America/New_York')).toBe('2026-03-07');
    expect(dayOf('2026-03-08T05:00:00.000Z', 'America/New_York')).toBe('2026-03-08');
    // At 07:00 UTC the clocks jump from 02:00 to 03:00: still 8 March.
    expect(dayOf('2026-03-08T07:00:00.000Z', 'America/New_York')).toBe('2026-03-08');
    // Midnight after the change is 04:00 UTC: 8 March has 23 hours.
    expect(dayOf('2026-03-09T03:59:59.999Z', 'America/New_York')).toBe('2026-03-08');
    expect(dayOf('2026-03-09T04:00:00.000Z', 'America/New_York')).toBe('2026-03-09');
  });

  it('follows the change back on 1 November 2026: that day has 25 hours', () => {
    expect(dayOf('2026-11-01T03:59:59.999Z', 'America/New_York')).toBe('2026-10-31');
    expect(dayOf('2026-11-01T04:00:00.000Z', 'America/New_York')).toBe('2026-11-01');
    expect(dayOf('2026-11-02T04:59:59.999Z', 'America/New_York')).toBe('2026-11-01');
    expect(dayOf('2026-11-02T05:00:00.000Z', 'America/New_York')).toBe('2026-11-02');
  });

  it('crosses a year end at the local midnight', () => {
    expect(dayOf('2026-12-31T16:59:59.999Z', 'Asia/Ho_Chi_Minh')).toBe('2026-12-31');
    expect(dayOf('2026-12-31T17:00:00.000Z', 'Asia/Ho_Chi_Minh')).toBe('2027-01-01');
  });

  it('throws for a zone Intl does not know', () => {
    expect(() => dayOf('2026-03-10T00:00:00.000Z', 'Mars/Olympus')).toThrow(RangeError);
  });
});

describe('addDays', () => {
  it('crosses a month end and a year end, both ways', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-02-01', -1)).toBe('2026-01-31');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });

  it('knows 29 February of leap years only', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('moves by many days or none, and every day has 24 hours, also on a daylight saving change', () => {
    expect(addDays('2026-10-27', 0)).toBe('2026-10-27');
    expect(addDays('2026-10-27', -370)).toBe('2025-10-22');
    expect(addDays('2025-10-22', 370)).toBe('2026-10-27');
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
  });
});

describe('isValidTimeZone', () => {
  it('accepts the IANA names Intl knows, in any case', () => {
    for (const name of ['Asia/Ho_Chi_Minh', 'America/New_York', 'Europe/London', 'UTC', 'asia/ho_chi_minh']) {
      expect(isValidTimeZone(name)).toBe(true);
    }
  });

  it('refuses unknown names, empty text and spaces around a name', () => {
    for (const name of ['Mars/Olympus', 'Asia/Hanoi', 'Not a zone', '', ' UTC']) {
      expect(isValidTimeZone(name)).toBe(false);
    }
  });
});

describe('the formatter cache', () => {
  /** `count` spellings of one zone, all valid (`Intl` takes any letter case): the bits of n pick the capitals of the city. */
  const spellings = (count: number) =>
    Array.from({ length: count }, (_, n) => {
      const city = [...'catamarca'].map((letter, at) => ((n >> at) & 1 ? letter.toUpperCase() : letter)).join('');
      return `America/Argentina/${city}`;
    });

  it('stays small, however many spellings of a zone learners send', () => {
    const names = spellings(MAX_FORMATTERS + 1);
    names.forEach((name) => expect(isValidTimeZone(name)).toBe(true));
    const made = vi.spyOn(Intl, 'DateTimeFormat');

    names.forEach((name) => isValidTimeZone(name));

    // A cache that kept every name would check them all again without making a single formatter.
    expect(made).toHaveBeenCalled();
  });
});
