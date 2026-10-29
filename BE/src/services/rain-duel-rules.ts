// The rules of a word rain duel (rain duel design §5, §6), without clocks or the database, so they are tested alone.
// `rain-duel.service.ts` runs them on the server clock.
import type { MatchResult } from '../models/match.model';

/** The numbers of a duel. Tests set smaller ones, like `matchSettings`; `resetRainDuelSettings` puts these back. */
export const rainDuelSettings = {
  lives: 3,
  lanes: 6,
  fallFromMs: 7000,
  fallToMs: 3500,
  spawnFromMs: 1800,
  spawnToMs: 700,
  durationMs: 120_000,
  /** A thrown word falls this much faster than the words of the rain at that moment. */
  thrownSpeedUp: 1.15,
  /** At most this many thrown words fall on one side at once; the next ones wait for a free place. */
  maxThrownFalling: 3,
  /** A word typed up to this long after it landed still counts: the same for both players, whatever their network. */
  graceMs: 150,
  /** A new word goes into a lane only once the newest word there has fallen this share of its way. */
  laneGap: 0.3
};
const DEFAULTS = { ...rainDuelSettings };
export const resetRainDuelSettings = () => Object.assign(rainDuelSettings, DEFAULTS);

/** One word of the rain both players get: when it appears (ms after the start), in which lane, how long it falls. */
export interface RainSpawn {
  index: number;
  text: string;
  lane: number;
  atMs: number;
  fallMs: number;
}

const lerp = (from: number, to: number, elapsedMs: number) =>
  Math.round(from + (to - from) * Math.min(1, Math.max(0, elapsedMs / rainDuelSettings.durationMs)));
export const fallMsAt = (elapsedMs: number) => lerp(rainDuelSettings.fallFromMs, rainDuelSettings.fallToMs, elapsedMs);
const spawnMsAt = (elapsedMs: number) => lerp(rainDuelSettings.spawnFromMs, rainDuelSettings.spawnToMs, elapsedMs);
export const thrownFallMsAt = (elapsedMs: number) => Math.round(fallMsAt(elapsedMs) / rainDuelSettings.thrownSpeedUp);

/** How long to wait before trying again when every lane is still busy. */
const RETRY_MS = 100;

/**
 * The rain of a whole match, the same for both players: words in the order given (wrapping around), each in a lane whose
 * newest word has fallen `laneGap` of its way, coming more often and falling faster as the match goes on.
 */
export const buildRainSchedule = (words: string[], rand: () => number): RainSpawn[] => {
  if (!words.length) return [];
  const { lanes, durationMs, laneGap } = rainDuelSettings;
  const newest: (RainSpawn | undefined)[] = Array.from({ length: lanes });
  const schedule: RainSpawn[] = [];
  let atMs = 0;
  while (atMs <= durationMs) {
    const free = newest.flatMap((spawn, lane) => (!spawn || atMs - spawn.atMs >= laneGap * spawn.fallMs ? [lane] : []));
    if (!free.length) {
      atMs += RETRY_MS;
      continue;
    }
    const index = schedule.length;
    const spawn = { index, text: words[index % words.length], lane: free[Math.min(free.length - 1, Math.floor(rand() * free.length))], atMs, fallMs: fallMsAt(atMs) };
    schedule.push(spawn);
    newest[spawn.lane] = spawn;
    atMs += spawnMsAt(atMs);
  }
  return schedule;
};

/** The server got the word at `receivedAt`: it counts if that is no later than the landing plus the grace time. */
export const isInTime = (receivedAt: number, landsAt: number) => receivedAt <= landsAt + rainDuelSettings.graceMs;

type Side = { lives: number; hits: number };
type Outcome = [MatchResult, MatchResult];

/**
 * The end of a duel, or `null` while it goes on: a player without lives loses (both at once: a draw); when the time is
 * up, more lives win, then more words typed, else a draw.
 */
export const rainOutcome = ([a, b]: Side[], timeUp: boolean): Outcome | null => {
  const aOut = a.lives <= 0;
  const bOut = b.lives <= 0;
  if (aOut && bOut) return ['draw', 'draw'];
  if (aOut) return ['loss', 'win'];
  if (bOut) return ['win', 'loss'];
  if (!timeUp) return null;
  const order = a.lives - b.lives || a.hits - b.hits;
  return order > 0 ? ['win', 'loss'] : order < 0 ? ['loss', 'win'] : ['draw', 'draw'];
};

/** The words of English passages for the rain: lower case, letters only, 3 to 10 of them, each once. */
export const rainWordsFrom = (contents: string[]) => {
  const words = contents
    .flatMap((content) => content.split(/\s+/))
    .map((token) => token.toLowerCase().replace(/[^a-z]/g, ''))
    .filter((word) => word.length >= 3 && word.length <= 10);
  return [...new Set(words)];
};
