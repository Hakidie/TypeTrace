import { describe, expect, it } from 'vitest';
import { applyRainEvent, SETTLED_MS } from './rain-duel';

const drop = (id: string, text = 'wind', extra = {}) => ({ id, text, lane: 2, bornAt: 1000, fallMs: 7000, thrown: false, ...extra });
const spawn = (side: string, id: string, extra = {}) => ({ type: 'spawn' as const, serverNow: 1000, side, drop: drop(id, 'wind', extra) });

describe('applyRainEvent', () => {
  it('adds a spawned word to its side, falling, in the middle of its lane', () => {
    const state = applyRainEvent(undefined, spawn('u1', '1'));

    expect(state.sides.u1.drops).toEqual([expect.objectContaining({ id: '1', text: 'wind', state: 'falling', bornAt: 1000, fallMs: 7000, typed: 0 })]);
    expect(state.sides.u1.drops[0].x).toBeCloseTo((2.5 / 6) * 100);
  });

  it('pops a hit word', () => {
    const state = applyRainEvent(applyRainEvent(undefined, spawn('u1', '1')), { type: 'hit', serverNow: 1500, side: 'u1', id: '1', thrownTo: 'u2' });

    expect(state.sides.u1.drops[0].state).toBe('popped');
    expect(state.sides.u1.hits).toBe(1);
    expect(state.lastHit).toEqual({ side: 'u1', id: '1', thrownTo: 'u2', at: 1500 });
  });

  it('remembers a thrown word that falls on a side', () => {
    const state = applyRainEvent(undefined, { ...spawn('u2', '9', { thrown: true }), serverNow: 1600 });

    expect(state.lastThrow).toEqual({ to: 'u2', text: 'wind', at: 1600 });
  });

  it('marks a landed word missed and sets the lives', () => {
    const state = applyRainEvent(applyRainEvent(undefined, spawn('u1', '1')), { type: 'land', serverNow: 8200, side: 'u1', id: '1', lives: 2 });

    expect(state.sides.u1.drops[0].state).toBe('missed');
    expect(state.sides.u1.lives).toBe(2);
    expect(state.lastLand).toEqual({ side: 'u1', at: 8200 });
  });

  it('drops the words settled a while ago', () => {
    const hit = applyRainEvent(applyRainEvent(undefined, spawn('u1', '1')), { type: 'hit', serverNow: 1500, side: 'u1', id: '1' });
    const later = applyRainEvent(hit, { ...spawn('u1', '2'), serverNow: 1500 + SETTLED_MS + 1 });

    expect(later.sides.u1.drops.map((entry) => entry.id)).toEqual(['2']);
  });

  it('replaces everything with a snapshot', () => {
    const before = applyRainEvent(undefined, spawn('u1', '1'));
    const state = applyRainEvent(before, {
      type: 'snapshot',
      serverNow: 5000,
      startedAt: 100,
      endsAt: 120_100,
      sides: { u1: { lives: 1, hits: 4, drops: [drop('7', 'moon')] }, u2: { lives: 3, hits: 2, drops: [] } },
    });

    expect(state).toMatchObject({ startedAt: 100, endsAt: 120_100 });
    expect(state.sides.u1).toMatchObject({ lives: 1, hits: 4 });
    expect(state.sides.u1.drops.map((entry) => entry.text)).toEqual(['moon']);
    expect(state.sides.u2.lives).toBe(3);
  });
});

describe('applyRainEvent thrown words', () => {
  it('keeps whether a word was thrown', () => {
    const state = applyRainEvent(undefined, spawn('u2', '9', { thrown: true }));

    expect(state.sides.u2.drops[0].thrown).toBe(true);
  });
});
