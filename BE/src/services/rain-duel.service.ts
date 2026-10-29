// A word rain duel while it runs (rain duel design §5–§7): the server keeps the rain, one landing timer per word, and is
// the only judge. The state lives in this process only, like the rest of `match-hub`; a restart loses it and the match
// ends unrated (`interrupted`, see `match.service.ts`).
import type { MatchDocument, MatchResult } from '../models/match.model';
import { cancelTimer, publish, publishTo, schedule } from './match-hub';
import { buildRainSchedule, isInTime, rainDuelSettings, rainOutcome, RainSpawn, thrownFallMsAt } from './rain-duel-rules';

export interface RainDrop {
  id: string;
  text: string;
  lane: number;
  /** Server time (ms) the word appeared; it lands at `bornAt + fallMs`. */
  bornAt: number;
  fallMs: number;
  /** Thrown by the other player: falls faster and is never thrown back. */
  thrown: boolean;
}

interface Side {
  userId: string;
  lives: number;
  hits: number;
  thrown: number;
  drops: Map<string, RainDrop>;
  /** Thrown words waiting for a place (`maxThrownFalling`). */
  queue: string[];
}

export interface RainSideResult {
  userId: string;
  lives: number;
  hits: number;
  thrown: number;
}

/** Ends the match with these results (per user id); `match.service.ts` saves, rates and announces it. Runs in the lock. */
export type EndRainDuel = (results: Map<string, MatchResult>, sides: RainSideResult[]) => Promise<void>;
/** Runs a change of the room in its match lock (`withMatchLock`). */
export type MatchLock = (task: () => Promise<void>) => Promise<void>;

interface Duel {
  code: string;
  startedAt: number;
  endsAt: number;
  schedule: RainSpawn[];
  next: number;
  sides: [Side, Side];
  lastId: number;
  timers: Set<string>;
  lock: MatchLock;
  onEnd: EndRainDuel;
}

const duels = new Map<string, Duel>();
/**
 * Every duel started by this process, ended or not. Only a restart forgets them, so a running rain match whose code is
 * not here lost its rain in a restart (`interrupted`); a duel stopped a moment before its end is saved is still here.
 * ponytail: grows by one short code per duel for the life of the process; clear old codes if that ever matters.
 */
const startedHere = new Set<string>();

/** The rain of this room is falling now. */
export const isRaining = (code: string) => duels.has(code);
/** This process started the duel of this room (see `startedHere`). */
export const wasStartedHere = (code: string) => startedHere.has(code);

/** Stops the rain of a room: cancels its timers and forgets it. Safe to call for a room without rain. */
export const stopRainDuel = (code: string) => {
  const duel = duels.get(code);
  if (!duel) return;
  duel.timers.forEach((name) => cancelTimer(code, name));
  duels.delete(code);
};

/** Forgets every duel and its timers: for tests, and what a restart of the server does. */
export const resetRainDuel = () => {
  [...duels.keys()].forEach(stopRainDuel);
  startedHere.clear();
};

const send = (duel: Duel, data: Record<string, unknown>) => publish(duel.code, 'rain', { ...data, serverNow: Date.now() });

/** A timer of the duel; its change runs in the match lock, and not at all once the duel is over. */
const later = (duel: Duel, name: string, ms: number, fn: () => Promise<void> | void) => {
  duel.timers.add(name);
  schedule(duel.code, name, Math.max(0, ms), () =>
    duel.lock(async () => {
      duel.timers.delete(name);
      if (duels.get(duel.code) === duel) await fn();
    })
  );
};

const thrownFalling = (side: Side) => [...side.drops.values()].filter((drop) => drop.thrown).length;

/** Checks the end after a change; once ended the duel is stopped and `onEnd` settles the match. */
const settle = async (duel: Duel, timeUp = false) => {
  const outcome = rainOutcome(duel.sides, timeUp);
  if (!outcome) return;
  const results = new Map(duel.sides.map((side, index) => [side.userId, outcome[index]]));
  const sides = duel.sides.map(({ userId, lives, hits, thrown }) => ({ userId, lives, hits, thrown }));
  // The rain stays until the end is saved: a reader that finds a running rain match without its rain takes it for a
  // duel lost in a restart. `finish` stops it; `finally` covers an end that found no running match.
  try {
    await duel.onEnd(results, sides);
  } finally {
    stopRainDuel(duel.code);
  }
};

const addDrop = (duel: Duel, side: Side, text: string, lane: number, fallMs: number, thrown: boolean) => {
  duel.lastId += 1;
  const drop: RainDrop = { id: String(duel.lastId), text, lane, bornAt: Date.now(), fallMs, thrown };
  side.drops.set(drop.id, drop);
  send(duel, { type: 'spawn', side: side.userId, drop });
  // The grace time is in the timer: a word typed up to `graceMs` after it landed still counts, for both players alike.
  later(duel, `rain:land:${drop.id}`, fallMs + rainDuelSettings.graceMs, () => land(duel, side, drop.id));
};

/** The lane with the fewest words falling, for a thrown word (it does not follow the shared rain). */
const quietLane = (side: Side) => {
  const counts = Array.from({ length: rainDuelSettings.lanes }, () => 0);
  side.drops.forEach((drop) => (counts[drop.lane] += 1));
  return counts.indexOf(Math.min(...counts));
};

const throwTo = (duel: Duel, side: Side, text: string) => {
  if (thrownFalling(side) >= rainDuelSettings.maxThrownFalling) {
    side.queue.push(text);
    return;
  }
  addDrop(duel, side, text, quietLane(side), thrownFallMsAt(Date.now() - duel.startedAt), true);
};

/** A thrown word left this side: the next one waiting falls. */
const releaseQueue = (duel: Duel, side: Side) => {
  const text = side.queue.shift();
  if (text) throwTo(duel, side, text);
};

const land = async (duel: Duel, side: Side, id: string) => {
  const drop = side.drops.get(id);
  if (!drop) return;
  side.drops.delete(id);
  side.lives -= 1;
  send(duel, { type: 'land', side: side.userId, id, lives: side.lives });
  if (drop.thrown) releaseQueue(duel, side);
  await settle(duel);
};

/** Drops every spawn that is due on both sides, then waits for the next one. */
const spawnDue = (duel: Duel) => {
  const elapsed = Date.now() - duel.startedAt;
  while (duel.next < duel.schedule.length && duel.schedule[duel.next].atMs <= elapsed) {
    const { text, lane, fallMs } = duel.schedule[duel.next];
    duel.sides.forEach((side) => addDrop(duel, side, text, lane, fallMs, false));
    duel.next += 1;
  }
  const upcoming = duel.schedule[duel.next];
  if (upcoming) later(duel, 'rain:spawn', duel.startedAt + upcoming.atMs - Date.now(), () => spawnDue(duel));
};

/**
 * Starts the rain of a match about to run, from its words (`targetWords`): one schedule for both players. Called inside
 * the match lock, before the match is saved as running, so no request ever sees a running rain match without its rain.
 */
export const startRainDuel = (match: MatchDocument, lock: MatchLock, onEnd: EndRainDuel) => {
  const startedAt = Date.now();
  const side = (userId: string): Side => ({ userId, lives: rainDuelSettings.lives, hits: 0, thrown: 0, drops: new Map(), queue: [] });
  const duel: Duel = {
    code: match.code,
    startedAt,
    endsAt: startedAt + rainDuelSettings.durationMs,
    schedule: buildRainSchedule(match.targetWords, Math.random),
    next: 0,
    sides: [side(String(match.players[0].user)), side(String(match.players[1].user))],
    lastId: 0,
    timers: new Set(),
    lock,
    onEnd
  };
  duels.set(match.code, duel);
  startedHere.add(match.code);
  later(duel, 'rain:spawn', 0, () => spawnDue(duel));
  later(duel, 'rain:end', rainDuelSettings.durationMs, () => settle(duel, true));
  return { startedAt: new Date(startedAt), endsAt: new Date(duel.endsAt) };
};

/**
 * A player sent a typed word (called inside the match lock). It hits the word of that text on their side that lands
 * first, if the server got it in time; a hit word of the rain is thrown to the other side, a thrown one is not.
 */
export const hitRainWord = async (code: string, userId: string, text: string) => {
  const duel = duels.get(code);
  const side = duel?.sides.find((entry) => entry.userId === userId);
  if (!duel || !side) return { hit: false };
  const now = Date.now();
  const wanted = text.trim().toLowerCase();
  const drop = [...side.drops.values()]
    .filter((candidate) => candidate.text === wanted && isInTime(now, candidate.bornAt + candidate.fallMs))
    .sort((a, b) => a.bornAt + a.fallMs - (b.bornAt + b.fallMs))[0];
  if (!drop) return { hit: false };
  side.drops.delete(drop.id);
  cancelTimer(code, `rain:land:${drop.id}`);
  duel.timers.delete(`rain:land:${drop.id}`);
  side.hits += 1;
  const other = duel.sides[0] === side ? duel.sides[1] : duel.sides[0];
  send(duel, { type: 'hit', side: userId, id: drop.id, ...(!drop.thrown && { thrownTo: other.userId }) });
  if (drop.thrown) releaseQueue(duel, side);
  else {
    side.thrown += 1;
    throwTo(duel, other, drop.text);
  }
  await settle(duel);
  return { hit: true };
};

/** Everything a player needs to draw the duel again (a reconnect), sent to that player only. */
export const sendRainSnapshot = (code: string, userId: string) => {
  const duel = duels.get(code);
  if (!duel) return;
  const sides = Object.fromEntries(
    duel.sides.map((side) => [side.userId, { lives: side.lives, hits: side.hits, drops: [...side.drops.values()] }])
  );
  publishTo(code, userId, 'rain', { type: 'snapshot', serverNow: Date.now(), startedAt: duel.startedAt, endsAt: duel.endsAt, sides });
};
