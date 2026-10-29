import { describe, expect, it } from 'vitest';
import type { RainState } from '../types/rain.types';
import { fallMsAt, initialRainState, laneX, LANE_GAP, LIVES, MAX_TICK_MS, rainReducer, ROUND_MS, SETTLE_MS, spawnMsAt, targetOf } from './rain-game';

const play = (words: string[], lanes = 6) => rainReducer(initialRainState, { type: 'start', words, lanes });
const tick = (state: RainState, dt = 100, rand = 0) => rainReducer(state, { type: 'tick', dt, rand });
/** Ticks of 100 ms until `elapsed` reaches `ms`. */
const tickTo = (state: RainState, ms: number, rand = 0) => {
  let next = state;
  while (next.elapsed < ms && next.phase === 'playing') next = tick(next, 100, rand);
  return next;
};
const type = (state: RainState, text: string) => rainReducer(state, { type: 'input', text });
const land = (state: RainState, id: string) => rainReducer(state, { type: 'land', id });
/** A round with these words already falling, the first one spawned first. */
const withFalling = (words: string[]) => {
  let state = play(words);
  while (state.drops.length < words.length) state = tick(state, 100, state.drops.length / words.length);
  return state;
};

describe('rainReducer', () => {
  it('starts a round with full lives and no words', () => {
    const state = play(['nhà']);

    expect(state).toMatchObject({ phase: 'playing', lives: LIVES, score: 0, drops: [], elapsed: 0 });
    expect(LIVES).toBe(3);
  });

  it('spawns the first word on the first tick, in the lane picked by rand', () => {
    const state = tick(play(['nhà', 'cửa']), 100, 0.5);

    expect(state.drops).toHaveLength(1);
    expect(state.drops[0]).toMatchObject({ text: 'nhà', lane: 3, x: laneX(3, 6), fallMs: fallMsAt(100), state: 'falling', typed: 0 });
  });

  it('speeds up over the round', () => {
    expect(fallMsAt(0)).toBe(7000);
    expect(fallMsAt(ROUND_MS)).toBe(3500);
    expect(spawnMsAt(0)).toBe(1800);
    expect(spawnMsAt(ROUND_MS)).toBe(700);
  });

  it('keeps a new word out of a lane whose newest word is still near the top', () => {
    const first = tick(play(['nhà', 'cửa'], 1));
    const bornAt = first.drops[0].bornAt;
    const freeAt = bornAt + LANE_GAP * first.drops[0].fallMs;

    expect(tickTo(first, freeAt - 100).drops).toHaveLength(1);
    expect(tickTo(first, freeAt + 100).drops).toHaveLength(2);
  });

  it('targets the earliest falling word that starts with the input', () => {
    const state = type(withFalling(['nhà', 'nhanh']), 'nh');

    expect(targetOf(state)?.text).toBe('nhà');
    expect(state.drops.find((drop) => drop.text === 'nhà')?.typed).toBe(2);
    expect(state.drops.find((drop) => drop.text === 'nhanh')?.typed).toBe(0);
  });

  it('targets a word while the IME has not added the marks yet', () => {
    const falling = withFalling(['tiếng']);

    const partial = type(falling, 'tie');
    expect(targetOf(partial)?.text).toBe('tiếng');
    expect(partial.drops[0].typed).toBe(3);
    expect(type(falling, 'tieng').drops[0].state).toBe('falling');
    expect(type(falling, 'tiếng').drops[0].state).toBe('popped');
  });

  it('pops a word typed in its decomposed form', () => {
    expect(type(withFalling(['tiếng']), 'tiếng'.normalize('NFD')).drops[0].state).toBe('popped');
  });

  it('scores a typed word', () => {
    const before = withFalling(['nhà']);
    const state = type(before, 'nhà');

    expect(state).toMatchObject({ score: 1, typedChars: 3, input: '' });
    expect(state.reaction?.kind).toBe('hop');
    expect(state.reaction?.key).not.toBe(before.reaction?.key);
  });

  it('clears the input on space or Enter', () => {
    const state = withFalling(['nhà']);

    expect(type(state, 'nh ').input).toBe('');
    expect(type(state, 'nh\n').input).toBe('');
  });

  it('loses a life when a word lands', () => {
    const typing = type(withFalling(['nhà']), 'nh');
    const state = land(typing, typing.drops[0].id);

    expect(state.drops[0].state).toBe('missed');
    expect(state.lives).toBe(LIVES - 1);
    expect(state.reaction?.kind).toBe('shake');
    expect(state.input).toBe('');
  });

  it('ends the round after the third landing', () => {
    let state = withFalling(['nhà', 'cửa', 'bàn']);
    for (const drop of state.drops) state = land(state, drop.id);

    expect(state.phase).toBe('lost');
    expect(state.lives).toBe(0);
  });

  it('ignores a late landing', () => {
    const popped = type(withFalling(['nhà']), 'nhà');

    expect(land(popped, popped.drops[0].id)).toBe(popped);
    expect(land(popped, 'nope')).toBe(popped);
    const over = { ...withFalling(['nhà']), phase: 'won' as const };
    expect(land(over, over.drops[0].id)).toBe(over);
  });

  it('removes a settled word after 400 ms', () => {
    const popped = type(withFalling(['nhà']), 'nhà');
    const settledAt = popped.drops[0].settledAt!;

    expect(SETTLE_MS).toBe(400);
    expect(tickTo(popped, settledAt + SETTLE_MS - 100).drops.some((drop) => drop.text === 'nhà')).toBe(true);
    expect(tickTo(popped, settledAt + SETTLE_MS).drops.some((drop) => drop.text === 'nhà' && drop.state === 'popped')).toBe(false);
  });

  it('wins when the time is up with lives left', () => {
    const state = tickTo(play(['nhà', 'cửa']), ROUND_MS);

    expect(state.phase).toBe('won');
    expect(state.elapsed).toBe(ROUND_MS);
    expect(tick(state)).toBe(state);
  });

  it('does not burst after a long tick', () => {
    const state = tick(play(['nhà', 'cửa', 'bàn']), 3000);

    expect(state.elapsed).toBe(MAX_TICK_MS);
    expect(state.drops).toHaveLength(1);
  });

  it('cycles through the words when they run out', () => {
    let state = play(['nhà', 'cửa']);
    while (state.drops.length < 3) state = tick(state);

    expect(state.drops.map((drop) => drop.text)).toEqual(['nhà', 'cửa', 'nhà']);
  });

  it('starts with an empty word list without spawning', () => {
    expect(tickTo(play([]), 5000).drops).toEqual([]);
  });
});
