import type { GameDrop, RainAction, RainState } from '../types/rain.types';

/** A round lasts a minute; three words on the ground end it sooner. */
export const ROUND_MS = 60_000;
export const LIVES = 3;
/** A new word goes into a lane only once the newest word there has fallen this share of its way, so words never overlap. */
export const LANE_GAP = 0.3;
/** How long a typed or missed word stays on the stage (its pop or splat) before it is removed. */
export const SETTLE_MS = 400;
/** A longer tick (the computer was busy) counts as this long, so the game never jumps ahead. */
export const MAX_TICK_MS = 250;

const lerp = (from: number, to: number, elapsed: number) => from + (to - from) * Math.min(1, elapsed / ROUND_MS);
/** The words fall faster and come more often as the round goes on. */
export const fallMsAt = (elapsed: number) => lerp(7000, 3500, elapsed);
export const spawnMsAt = (elapsed: number) => lerp(1800, 700, elapsed);
/** The middle of a lane, in percent of the stage width. */
export const laneX = (lane: number, lanes: number) => ((lane + 0.5) / lanes) * 100;

const exact = (text: string) => text.normalize('NFC').toLowerCase();
/**
 * Without the Vietnamese marks: a Telex or VNI keyboard shows "tie" before "tiế", so the word being typed is found by its
 * letters alone. Only the exact word (marks included) is a hit.
 */
const loose = (text: string) => exact(text).normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd');

export const initialRainState: RainState = {
  phase: 'ready',
  elapsed: 0,
  lives: LIVES,
  score: 0,
  typedChars: 0,
  drops: [],
  words: [],
  next: 0,
  input: '',
  nextSpawnAt: 0,
  lanes: 6,
  reaction: null,
  lastId: 0,
};

/** The falling word the input is a start of, the one that appeared first; none for an empty input. */
export const targetOf = (state: RainState): GameDrop | undefined => {
  const typed = loose(state.input);
  if (!typed) return undefined;
  return state.drops.filter((drop) => drop.state === 'falling' && loose(drop.text).startsWith(typed)).sort((a, b) => a.bornAt - b.bornAt)[0];
};

/** Marks the letters typed on the target only. */
const retarget = (state: RainState): RainState => {
  const target = targetOf(state);
  const typed = loose(state.input).length;
  return { ...state, drops: state.drops.map((drop) => ({ ...drop, typed: drop === target ? typed : 0 })) };
};

const react = (state: RainState, kind: 'hop' | 'shake') => ({ kind, key: (state.reaction?.key ?? 0) + 1 });

const spawn = (state: RainState, rand: number): RainState => {
  const { elapsed, lanes, words } = state;
  if (!words.length || elapsed < state.nextSpawnAt) return state;
  const busy = (lane: number) =>
    state.drops.some((drop) => drop.lane === lane && drop.state === 'falling' && elapsed - drop.bornAt < LANE_GAP * drop.fallMs);
  const free = Array.from({ length: lanes }, (_, lane) => lane).filter((lane) => !busy(lane));
  // No free lane: the spawn stays due and is tried again on the next tick.
  if (!free.length) return state;
  const lane = free[Math.min(free.length - 1, Math.floor(rand * free.length))];
  const id = state.lastId + 1;
  const drop: GameDrop = {
    id: String(id),
    text: words[state.next % words.length],
    x: laneX(lane, lanes),
    fallMs: fallMsAt(elapsed),
    typed: 0,
    state: 'falling',
    lane,
    bornAt: elapsed,
  };
  return retarget({ ...state, drops: [...state.drops, drop], next: state.next + 1, lastId: id, nextSpawnAt: elapsed + spawnMsAt(elapsed) });
};

const tick = (state: RainState, dt: number, rand: number): RainState => {
  const elapsed = Math.min(ROUND_MS, state.elapsed + Math.min(dt, MAX_TICK_MS));
  const drops = state.drops.filter((drop) => drop.settledAt === undefined || elapsed - drop.settledAt < SETTLE_MS);
  const next = spawn({ ...state, elapsed, drops }, rand);
  return elapsed >= ROUND_MS ? { ...next, phase: 'won' } : next;
};

const input = (state: RainState, text: string): RainState => {
  if (/\s/.test(text)) return retarget({ ...state, input: '' });
  const typed = { ...state, input: text };
  const target = targetOf(typed);
  if (!target || exact(target.text) !== exact(text)) return retarget(typed);
  return retarget({
    ...typed,
    input: '',
    score: state.score + 1,
    typedChars: state.typedChars + target.text.length,
    reaction: react(state, 'hop'),
    drops: state.drops.map((drop) => (drop.id === target.id ? { ...drop, state: 'popped', settledAt: state.elapsed } : drop)),
  });
};

const land = (state: RainState, id: string): RainState => {
  const drop = state.drops.find((candidate) => candidate.id === id);
  if (state.phase !== 'playing' || drop?.state !== 'falling') return state;
  const lives = state.lives - 1;
  return retarget({
    ...state,
    lives,
    phase: lives > 0 ? 'playing' : 'lost',
    // The word being typed is gone: start the next one from an empty box.
    input: targetOf(state)?.id === id ? '' : state.input,
    reaction: react(state, 'shake'),
    drops: state.drops.map((candidate) => (candidate.id === id ? { ...candidate, state: 'missed', settledAt: state.elapsed } : candidate)),
  });
};

/** The rules of word rain. Pure: the clock (`tick`), the keyboard (`input`) and the stage (`land`) feed it. */
export const rainReducer = (state: RainState, action: RainAction): RainState => {
  if (action.type === 'start') return { ...initialRainState, phase: 'playing', words: action.words, lanes: action.lanes };
  if (state.phase !== 'playing') return state;
  if (action.type === 'tick') return tick(state, action.dt, action.rand);
  if (action.type === 'input') return input(state, action.text);
  return land(state, action.id);
};
