import { describe, expect, it } from 'vitest';
import { BOT_LEVELS, botPlan, buildPracticeSchedule, duelOutcome, pickThrown, practiceReducer, PRACTICE_PACE, startPractice, type PracticeState } from './practice-duel';

/** A repeatable stand-in for Math.random. */
const seeded = (seed = 7) => {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return value / 2147483647;
  };
};
const WORDS = ['mưa', 'nhà', 'cửa', 'bàn', 'ghế', 'sách', 'đèn', 'trường'];
const tick = (state: PracticeState, dt: number, rand = seeded()) => practiceReducer(state, { type: 'tick', dt, rand });
const run = (state: PracticeState, ms: number, step = 100, rand = seeded()) => {
  for (let t = 0; t < ms; t += step) state = tick(state, step, rand);
  return state;
};

describe('practice duel rules', () => {
  it('lets the bot miss one word in six, else type it after 2.5 to 6 s', () => {
    expect(botPlan(1000, () => 0.1)).toBeNull();
    expect(botPlan(1000, () => 0.5)).toBe(1000 + 2500 + 0.5 * 3500);
    expect(botPlan(0, () => 0.99)).toBeLessThanOrEqual(6000);
  });

  it('gives each level its bot, its pace and its typing speed', () => {
    expect(BOT_LEVELS.medium).toMatchObject({ bot: 'nhip', name: 'Nhịp', tier: 'Gold', missRate: 1 / 10, typeAfterMs: [1500, 4000] });
    expect(BOT_LEVELS.hard.pace).toEqual({ spawnFromMs: 1800, spawnToMs: 800, fallFromMs: 6500, fallToMs: 3500, maxThrownFalling: 3, maxWordLength: 10 });
    expect(botPlan(1000, () => 0.04, 'hard')).toBeNull();
    expect(botPlan(1000, () => 0.06, 'hard')).toBe(1000 + 800 + 0.06 * 1700);
    expect(botPlan(1000, () => 0.5, 'easy')).toBe(1000 + 2500 + 0.5 * 3500);
  });

  it('rains faster with longer words at a harder level', () => {
    const words = [...WORDS, 'tenletters', 'elevenwords'];
    const hard = buildPracticeSchedule(words, seeded(), 'hard');
    expect(hard[0]).toMatchObject({ atMs: 0, fallMs: 6500 });
    expect(hard.every((spawn) => [...spawn.text].length <= 10)).toBe(true);
    expect(hard.some((spawn) => spawn.text === 'tenletters')).toBe(true);
    expect(hard.length).toBeGreaterThan(buildPracticeSchedule(words, seeded(), 'easy').length);
  });

  it('uses every word when none is short enough for the level', () => {
    expect(buildPracticeSchedule(['elevenwords'], seeded(), 'easy')[0].text).toBe('elevenwords');
  });

  it('starts at the easy level by default (the tutorial)', () => {
    expect(startPractice(WORDS, seeded()).level).toBe('easy');
    expect(startPractice(WORDS, seeded(), 'hard').level).toBe('hard');
  });

  it('throws a word not falling on that side yet', () => {
    expect(pickThrown(['moon', 'sun', 'star'], new Set(['moon', 'sun']), () => 0)).toBe('star');
    expect(['moon', 'sun']).toContain(pickThrown(['moon', 'sun'], new Set(['moon', 'sun']), () => 0.5));
  });

  it('ends like the ranked rain duel', () => {
    expect(duelOutcome({ lives: 0, hits: 9 }, { lives: 2, hits: 1 }, false)).toBe('loss');
    expect(duelOutcome({ lives: 1, hits: 0 }, { lives: 0, hits: 5 }, false)).toBe('win');
    expect(duelOutcome({ lives: 0, hits: 0 }, { lives: 0, hits: 0 }, false)).toBe('draw');
    expect(duelOutcome({ lives: 2, hits: 3 }, { lives: 2, hits: 1 }, false)).toBeNull();
    expect(duelOutcome({ lives: 2, hits: 3 }, { lives: 2, hits: 1 }, true)).toBe('win');
  });

  it('rains at the Bronze pace with short words', () => {
    const schedule = buildPracticeSchedule([...WORDS, 'dàidàidài'], seeded());

    expect(schedule[0]).toMatchObject({ atMs: 0, fallMs: PRACTICE_PACE.fallFromMs });
    expect(schedule.every((spawn) => [...spawn.text].length <= PRACTICE_PACE.maxWordLength)).toBe(true);
    expect(schedule.at(-1)!.atMs).toBeLessThanOrEqual(PRACTICE_PACE.durationMs);
  });

  it('drops the same word on both sides', () => {
    const state = tick(startPractice(WORDS, seeded()), 100);

    expect(state.me.drops).toHaveLength(1);
    expect(state.bot.drops[0].text).toBe(state.me.drops[0].text);
  });

  it('throws a new word to Ping for a word typed in time', () => {
    let state = tick(startPractice(WORDS, seeded()), 100);
    const word = state.me.drops[0].text;

    state = practiceReducer(state, { type: 'type', text: word, rand: seeded() });

    expect(state.me.hits).toBe(1);
    expect(state.me.thrown).toBe(1);
    const thrown = state.bot.drops.find((drop) => drop.thrown);
    expect(thrown).toBeDefined();
    expect(thrown!.text).not.toBe(word);
    expect(state.lastThrow).toMatchObject({ to: 'bot', text: thrown!.text });
  });

  it('takes a life when a word lands, and ends by K.O.', () => {
    const start = startPractice(WORDS, seeded());
    // Nobody types on my side; the bot types its words, so I lose first.
    const state = run(start, 40_000);

    expect(state.me.lives).toBe(0);
    expect(state.result).toBe('loss');
    expect(state.missed.length).toBeGreaterThanOrEqual(3);
  });
});
