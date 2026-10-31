// A word rain duel while it runs (rain duel design §5–§7): the server keeps the rain, one landing timer per word, and is
// the only judge. The state lives in this process only, like the rest of `match-hub`; a restart loses it and the match
// ends unrated (`interrupted`, see `match.service.ts`).
import type { MatchDocument, MatchResult } from '../models/match.model';
import { cancelTimer, publish, publishTo, schedule } from './match-hub';
import { buildRainSchedule, isInTime, pickThrownWord, RainPace, rainDuelSettings, rainOutcome, RainSpawn, thrownFallMsAt, wordsForPace } from './rain-duel-rules';
import type { TierName } from './season.service';

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
  /** How many thrown words wait for a place (`maxThrownFalling`); each gets its word when it falls. */
  waiting: number;
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
  pace: RainPace;
  /** The words of this rain, also where thrown words come from. */
  words: string[];
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
  later(duel, `rain:land:${drop.id}`, fallMs + rainDuelSettings.graceMs, () => land(duel));
};

/** The lane with the fewest words falling, for a thrown word (it does not follow the shared rain). */
const quietLane = (side: Side) => {
  const counts = Array.from({ length: rainDuelSettings.lanes }, () => 0);
  side.drops.forEach((drop) => (counts[drop.lane] += 1));
  return counts.indexOf(Math.min(...counts));
};

/**
 * Throws a word onto a side: a word of the rain not falling there yet, so it is a new word to type, never a second copy
 * of one already on the screen (the word just typed still falls on the other side, the rain being the same).
 */
const throwTo = (duel: Duel, side: Side) => {
  if (thrownFalling(side) >= duel.pace.maxThrownFalling) {
    side.waiting += 1;
    return;
  }
  const falling = new Set([...side.drops.values()].map((drop) => drop.text));
  const text = pickThrownWord(duel.words, falling, Math.random);
  addDrop(duel, side, text, quietLane(side), thrownFallMsAt(Date.now() - duel.startedAt, duel.pace), true);
};

/** A thrown word left this side: the next one waiting falls. */
const releaseQueue = (duel: Duel, side: Side) => {
  if (side.waiting === 0) return;
  side.waiting -= 1;
  throwTo(duel, side);
};

/** Words due to land this close together (the same word of the shared rain on both sides) land as one moment. */
const LAND_TOGETHER_MS = 25;

/**
 * A landing timer went off: every word of both sides due by now lands, and only then is the end checked. The same word
 * of the rain lands on both sides at the same moment; checking after the first one would end the duel on whichever side
 * happened to be handled first, when both players lost their last life together (a draw).
 */
const land = async (duel: Duel) => {
  const now = Date.now() + LAND_TOGETHER_MS;
  let landed = false;
  for (const side of duel.sides) {
    for (const drop of [...side.drops.values()]) {
      if (drop.bornAt + drop.fallMs + rainDuelSettings.graceMs > now) continue;
      side.drops.delete(drop.id);
      cancelTimer(duel.code, `rain:land:${drop.id}`);
      duel.timers.delete(`rain:land:${drop.id}`);
      side.lives -= 1;
      landed = true;
      send(duel, { type: 'land', side: side.userId, id: drop.id, lives: side.lives });
      if (drop.thrown) releaseQueue(duel, side);
    }
  }
  if (landed) await settle(duel);
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
 * Starts the rain of a match about to run, from its words (`targetWords`) at the pace of `tier`: one schedule for both
 * players. Called inside the match lock, before the match is saved as running, so no request ever sees a running rain
 * match without its rain.
 */
export const startRainDuel = (match: MatchDocument, tier: TierName, lock: MatchLock, onEnd: EndRainDuel) => {
  const startedAt = Date.now();
  const pace = rainDuelSettings.paces[tier];
  const words = wordsForPace(match.targetWords, pace);
  const side = (userId: string): Side => ({ userId, lives: rainDuelSettings.lives, hits: 0, thrown: 0, drops: new Map(), waiting: 0 });
  const duel: Duel = {
    code: match.code,
    startedAt,
    endsAt: startedAt + rainDuelSettings.durationMs,
    pace,
    words,
    schedule: buildRainSchedule(words, Math.random, pace),
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
    throwTo(duel, other);
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
