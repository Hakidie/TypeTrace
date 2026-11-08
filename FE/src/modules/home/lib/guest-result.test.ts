import { describe, expect, it } from 'vitest';
import { summarizeGuestRun } from './guest-result';

describe('summarizeGuestRun', () => {
  it('counts WPM from the correct words, 5 characters to a word', () => {
    // "Tiếng Việt" is 9 characters + 1 space = 10 → 2 words in 6 seconds = 20 WPM.
    const run = summarizeGuestRun(['Tiếng', 'Việt'], ['Tiếng', 'Việt'], 6000);

    expect(run.wpm).toBe(20);
    expect(run.accuracy).toBe(100);
    expect(run.stats.every((stat) => stat.count === 0)).toBe(true);
  });

  it('leaves a wrong word out of the speed and out of the accuracy', () => {
    const run = summarizeGuestRun(['Tiếng', 'Việt'], ['Tiếng', 'Viet'], 6000);

    expect(run.accuracy).toBe(50);
    expect(run.wpm).toBe(10); // only "Tiếng": 5 characters in 6 seconds
    expect(run.results[1].errors.length).toBeGreaterThan(0);
  });

  it('stays finite when nothing was typed', () => {
    const run = summarizeGuestRun(['Tiếng'], [], 60000);

    expect(run).toMatchObject({ wpm: 0, accuracy: 100, results: [] });
  });
});
