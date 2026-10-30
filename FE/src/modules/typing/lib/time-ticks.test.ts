import { describe, expect, it } from 'vitest';
import { timeTicks } from './time-ticks';

describe('timeTicks', () => {
  it('puts a tick every 6 seconds on a one-minute chart', () => {
    expect(timeTicks(60)).toEqual([0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60]);
  });

  it('keeps at most 10 gaps for the other times and always ends on the last second', () => {
    expect(timeTicks(30)).toEqual([0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30]);
    expect(timeTicks(120)).toHaveLength(9);
    expect(timeTicks(65).at(-1)).toBe(65);
  });
});
