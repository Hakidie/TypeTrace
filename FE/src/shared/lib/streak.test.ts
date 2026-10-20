import { describe, expect, it } from 'vitest';
import { currentStreak } from './streak';

describe('currentStreak', () => {
  const daysAgo = (n: number) => {
    const date = new Date();
    date.setDate(date.getDate() - n);
    return { date: date.toISOString().slice(0, 10), sessions: 1 };
  };

  it('counts the days in a row up to today', () => {
    expect(currentStreak([daysAgo(0), daysAgo(1), daysAgo(2), daysAgo(4)])).toBe(3);
  });

  it('keeps the streak alive until the end of today', () => {
    expect(currentStreak([daysAgo(1), daysAgo(2)])).toBe(2);
  });

  it('is 0 after a missed day or without data', () => {
    expect(currentStreak([daysAgo(2), daysAgo(3)])).toBe(0);
    expect(currentStreak()).toBe(0);
  });
});
