import { describe, expect, it } from 'vitest';
import { addDays, dateKeyIn, dayInWords, sameTimeZone } from './local-date';

describe('local dates (SCRUM-31)', () => {
  it('gives the calendar day of a moment in a time zone, and the UTC day without one', () => {
    const evening = new Date('2026-03-10T18:00:00Z');

    expect(dateKeyIn(evening, 'Asia/Ho_Chi_Minh')).toBe('2026-03-11');
    expect(dateKeyIn(evening, 'America/New_York')).toBe('2026-03-10');
    expect(dateKeyIn(evening)).toBe('2026-03-10');
    expect(dateKeyIn(new Date('2026-12-31T17:30:00Z'), 'Asia/Ho_Chi_Minh')).toBe('2027-01-01');
  });

  it('falls back to the UTC day for a zone the browser does not know', () => {
    expect(dateKeyIn(new Date('2026-03-10T18:00:00Z'), 'Mars/Olympus_Mons')).toBe('2026-03-10');
  });

  it('moves a day forward and back across months, years and leap days', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-10-27', -370)).toBe('2025-10-22');
  });

  it('writes a day in words with fixed names', () => {
    expect(dayInWords('2026-10-27')).toBe('Tue, 27 Oct 2026');
    expect(dayInWords('2026-09-01')).toBe('Tue, 1 Sep 2026');
  });

  it('tells whether two names are the same zone', () => {
    expect(sameTimeZone('Asia/Ho_Chi_Minh', 'Asia/Ho_Chi_Minh')).toBe(true);
    expect(sameTimeZone('Asia/Ho_Chi_Minh', 'asia/ho_chi_minh')).toBe(true);
    expect(sameTimeZone('Europe/Paris', 'Asia/Ho_Chi_Minh')).toBe(false);
    expect(sameTimeZone('Europe/Paris', undefined)).toBe(false);
    expect(sameTimeZone('Europe/Paris', 'Not/A_Zone')).toBe(false);
  });

  it('takes two names of one zone as the same zone where Intl knows them as one, as Chrome and Node do', () => {
    // Chrome says Asia/Saigon where the account's default is Asia/Ho_Chi_Minh.
    expect(sameTimeZone('Asia/Saigon', 'Asia/Ho_Chi_Minh')).toBe(true);
    // The same hours today, but another zone.
    expect(sameTimeZone('Etc/GMT-7', 'Asia/Saigon')).toBe(false);
    expect(sameTimeZone('Asia/Bangkok', 'Asia/Ho_Chi_Minh')).toBe(false);
  });
});
