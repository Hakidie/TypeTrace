import type { RainDrop } from '@/modules/rain/types/rain.types';
import type { RainServerEvent } from '../types/ranked.types';

/** The lanes of a duel (`rainDuelSettings.lanes` on the server). */
const LANES = 6;
/** A typed or landed word stays this long (its pop or splat), then it is removed. */
export const SETTLED_MS = 600;

export interface RainDuelSide {
  lives: number;
  hits: number;
  drops: (RainDrop & { settledAt?: number })[];
}

/** A rain duel as the server told it so far (`rain` events). Times are server times. */
export interface RainDuelState {
  startedAt: number;
  endsAt: number;
  sides: Record<string, RainDuelSide>;
  /** The last word thrown onto a side, for the "Minh threw: moon" banner. */
  lastThrow?: { to: string; text: string; at: number };
  /** The last word hit, for the throw that flies across and the hop. */
  lastHit?: { side: string; id: string; thrownTo?: string; at: number };
  /** The last landing, for the shake and the flash. */
  lastLand?: { side: string; at: number };
}

const laneX = (lane: number) => ((lane + 0.5) / LANES) * 100;
const empty = (): RainDuelState => ({ startedAt: 0, endsAt: 0, sides: {} });
const sideOf = (state: RainDuelState, side: string): RainDuelSide => state.sides[side] ?? { lives: 3, hits: 0, drops: [] };

const toDrop = (drop: { id: string; text: string; lane: number; bornAt: number; fallMs: number }): RainDrop => ({
  id: drop.id,
  text: drop.text,
  x: laneX(drop.lane),
  fallMs: drop.fallMs,
  bornAt: drop.bornAt,
  typed: 0,
  state: 'falling',
});

const withSide = (state: RainDuelState, side: string, change: (current: RainDuelSide) => RainDuelSide) => ({
  ...state,
  sides: { ...state.sides, [side]: change(sideOf(state, side)) },
});

const settle = (drops: RainDuelSide['drops'], id: string, how: 'popped' | 'missed', at: number) =>
  drops.map((drop) => (drop.id === id ? { ...drop, state: how, settledAt: at } : drop));

/** Words typed or missed a while ago leave the stage. */
const prune = (state: RainDuelState, now: number): RainDuelState => ({
  ...state,
  sides: Object.fromEntries(
    Object.entries(state.sides).map(([side, entry]) => [side, { ...entry, drops: entry.drops.filter((drop) => !drop.settledAt || now - drop.settledAt <= SETTLED_MS) }]),
  ),
});

/** Applies one `rain` event of the server to the duel. */
export const applyRainEvent = (previous: RainDuelState | undefined, event: RainServerEvent): RainDuelState => {
  if (event.type === 'snapshot') {
    return {
      startedAt: event.startedAt,
      endsAt: event.endsAt,
      sides: Object.fromEntries(Object.entries(event.sides).map(([side, entry]) => [side, { lives: entry.lives, hits: entry.hits, drops: entry.drops.map(toDrop) }])),
    };
  }
  const state = prune(previous ?? empty(), event.serverNow);
  if (event.type === 'spawn') {
    const next = withSide(state, event.side, (side) => ({ ...side, drops: [...side.drops, toDrop(event.drop)] }));
    return event.drop.thrown ? { ...next, lastThrow: { to: event.side, text: event.drop.text, at: event.serverNow } } : next;
  }
  if (event.type === 'hit') {
    const next = withSide(state, event.side, (side) => ({ ...side, hits: side.hits + 1, drops: settle(side.drops, event.id, 'popped', event.serverNow) }));
    return { ...next, lastHit: { side: event.side, id: event.id, ...(event.thrownTo && { thrownTo: event.thrownTo }), at: event.serverNow } };
  }
  const next = withSide(state, event.side, (side) => ({ ...side, lives: event.lives, drops: settle(side.drops, event.id, 'missed', event.serverNow) }));
  return { ...next, lastLand: { side: event.side, at: event.serverNow } };
};
