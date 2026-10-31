import { afterEach, describe, expect, it } from 'vitest';
import {
  buildRainSchedule,
  fallMsAt,
  isInTime,
  pickThrownWord,
  rainDuelSettings,
  rainOutcome,
  rainWordsFrom,
  resetRainDuelSettings,
  thrownFallMsAt,
  wordsForPace
} from '../../src/services/rain-duel-rules';

/** A repeatable stand-in for Math.random. */
const seeded = (seed = 7) => {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return value / 2147483647;
  };
};
const WORDS = ['wind', 'moon', 'river', 'stone', 'cloud', 'bread', 'light', 'train'];
const { Bronze, Diamond } = rainDuelSettings.paces;

describe('rain duel rules', () => {
  afterEach(() => resetRainDuelSettings());

  it('builds one schedule that lasts the whole match', () => {
    const schedule = buildRainSchedule(WORDS, seeded(), Diamond);

    expect(schedule[0]).toMatchObject({ index: 0, text: 'wind', atMs: 0, fallMs: 6500 });
    expect(schedule[schedule.length - 1].atMs).toBeLessThanOrEqual(rainDuelSettings.durationMs);
    expect(schedule.every((spawn, i) => i === 0 || spawn.atMs > schedule[i - 1].atMs)).toBe(true);
    expect(schedule.every((spawn, i) => i === 0 || spawn.fallMs <= schedule[i - 1].fallMs)).toBe(true);
    expect(schedule.length).toBeGreaterThan(WORDS.length);
    expect(schedule[WORDS.length].text).toBe('wind');
  });

  it('keeps words of one lane apart', () => {
    const schedule = buildRainSchedule(WORDS, seeded(3), Diamond);

    for (const [i, spawn] of schedule.entries()) {
      const before = schedule.slice(0, i).filter((other) => other.lane === spawn.lane).pop();
      if (before) expect(spawn.atMs - before.atMs).toBeGreaterThanOrEqual(0.3 * before.fallMs);
    }
    expect(new Set(schedule.map((spawn) => spawn.lane)).size).toBeGreaterThan(1);
    expect(schedule.every((spawn) => spawn.lane >= 0 && spawn.lane < rainDuelSettings.lanes)).toBe(true);
  });

  it('is the same for both players', () => {
    expect(buildRainSchedule(WORDS, seeded(11), Bronze)).toEqual(buildRainSchedule(WORDS, seeded(11), Bronze));
  });

  it('has nothing to rain without words', () => {
    expect(buildRainSchedule([], seeded(), Bronze)).toEqual([]);
  });

  it('counts a hit in the grace time only', () => {
    expect(rainDuelSettings.graceMs).toBe(150);
    expect(isInTime(1150, 1000)).toBe(true);
    expect(isInTime(1151, 1000)).toBe(false);
  });

  it('speeds the fall up over the match and for thrown words', () => {
    expect(fallMsAt(0, Diamond)).toBe(6500);
    expect(fallMsAt(rainDuelSettings.durationMs, Diamond)).toBe(3500);
    expect(thrownFallMsAt(0, Diamond)).toBe(Math.round(6500 / 1.15));
  });

  it('rains gentler for a lower tier', () => {
    const bronze = buildRainSchedule(WORDS, seeded(5), Bronze);
    const diamond = buildRainSchedule(WORDS, seeded(5), Diamond);

    expect(fallMsAt(0, Bronze)).toBe(9000);
    expect(fallMsAt(rainDuelSettings.durationMs, Bronze)).toBe(6000);
    // Fewer words in the same two minutes, and they fall slower.
    expect(bronze.length).toBeLessThan(diamond.length);
    expect(Bronze.maxThrownFalling).toBeLessThan(Diamond.maxThrownFalling);
  });

  it('keeps the words of a tier short enough', () => {
    expect(wordsForPace(['moon', 'river', 'mountain', 'beautiful'], Bronze)).toEqual(['moon', 'river']);
    expect(wordsForPace(['mountain', 'beautiful'], Bronze)).toEqual(['mountain', 'beautiful']);
    expect(wordsForPace(['mountain', 'beautiful'], Diamond)).toEqual(['mountain', 'beautiful']);
  });

  it('throws a word that is not falling on that side yet', () => {
    const falling = new Set(['wind', 'moon', 'river', 'stone', 'cloud', 'bread', 'light']);
    for (let seed = 1; seed < 20; seed += 1) expect(pickThrownWord(WORDS, falling, seeded(seed))).toBe('train');
    // Every word is falling already: any of them still comes.
    expect(WORDS).toContain(pickThrownWord(WORDS, new Set(WORDS), seeded()));
  });

  it('ends when a player has no life left', () => {
    expect(rainOutcome([{ lives: 0, hits: 5 }, { lives: 2, hits: 1 }], false)).toEqual(['loss', 'win']);
    expect(rainOutcome([{ lives: 1, hits: 5 }, { lives: 0, hits: 9 }], false)).toEqual(['win', 'loss']);
    expect(rainOutcome([{ lives: 0, hits: 5 }, { lives: 0, hits: 1 }], false)).toEqual(['draw', 'draw']);
    expect(rainOutcome([{ lives: 1, hits: 5 }, { lives: 2, hits: 1 }], false)).toBeNull();
  });

  it('decides a timed-out match by lives, then hits', () => {
    expect(rainOutcome([{ lives: 2, hits: 4 }, { lives: 1, hits: 9 }], true)).toEqual(['win', 'loss']);
    expect(rainOutcome([{ lives: 2, hits: 4 }, { lives: 2, hits: 9 }], true)).toEqual(['loss', 'win']);
    expect(rainOutcome([{ lives: 2, hits: 4 }, { lives: 2, hits: 4 }], true)).toEqual(['draw', 'draw']);
  });

  it('takes clean English words from passages', () => {
    expect(rainWordsFrom(["It's a sunny day, isn't it? Sunny!", 'Extraordinarily long words stay out.'])).toEqual([
      'its',
      'sunny',
      'day',
      'isnt',
      'long',
      'words',
      'stay',
      'out'
    ]);
  });
});
