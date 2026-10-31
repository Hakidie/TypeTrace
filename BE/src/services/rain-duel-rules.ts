// The rules of a word rain duel (rain duel design §5, §6), without clocks or the database, so they are tested alone.
// `rain-duel.service.ts` runs them on the server clock.
import type { MatchResult } from '../models/match.model';
import type { TierName } from './season.service';

/**
 * How hard the rain of one tier is: the gap between two words and their fall go from the first value to the second over
 * the match, at most `maxThrownFalling` thrown words fall on one side at once, and no word is longer than `maxWordLength`.
 */
export interface RainPace {
  spawnFromMs: number;
  spawnToMs: number;
  fallFromMs: number;
  fallToMs: number;
  maxThrownFalling: number;
  maxWordLength: number;
}

const pace = (spawnFromMs: number, spawnToMs: number, fallFromMs: number, fallToMs: number, maxThrownFalling: number, maxWordLength: number): RainPace => ({
  spawnFromMs, spawnToMs, fallFromMs, fallToMs, maxThrownFalling, maxWordLength
});

/** The numbers of a duel. Tests set smaller ones, like `matchSettings`; `resetRainDuelSettings` puts these back. */
export const rainDuelSettings = {
  lives: 3,
  lanes: 6,
  durationMs: 120_000,
  /** The rain of a duel follows the tier of the two players' average rating: one rain, the same for both. */
  paces: {
    Bronze: pace(2800, 1600, 9000, 6000, 1, 6),
    Silver: pace(2400, 1300, 8000, 5000, 2, 7),
    Gold: pace(2100, 1100, 7500, 4500, 2, 8),
    Platinum: pace(1900, 900, 7000, 4000, 3, 9),
    Diamond: pace(1800, 800, 6500, 3500, 3, 10),
    Legend: pace(1800, 800, 6500, 3500, 3, 10)
  } as Record<TierName, RainPace>,
  /** A thrown word falls this much faster than the words of the rain at that moment. */
  thrownSpeedUp: 1.15,
  /** A word typed up to this long after it landed still counts: the same for both players, whatever their network. */
  graceMs: 150,
  /** A new word goes into a lane only once the newest word there has fallen this share of its way. */
  laneGap: 0.3
};
const DEFAULTS = structuredClone(rainDuelSettings);
export const resetRainDuelSettings = () => Object.assign(rainDuelSettings, structuredClone(DEFAULTS));

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
export const fallMsAt = (elapsedMs: number, pace: RainPace) => lerp(pace.fallFromMs, pace.fallToMs, elapsedMs);
const spawnMsAt = (elapsedMs: number, pace: RainPace) => lerp(pace.spawnFromMs, pace.spawnToMs, elapsedMs);
export const thrownFallMsAt = (elapsedMs: number, pace: RainPace) => Math.round(fallMsAt(elapsedMs, pace) / rainDuelSettings.thrownSpeedUp);

/** The words of a rain at this pace: those no longer than `maxWordLength` (all of them if none is that short). */
export const wordsForPace = (words: string[], pace: RainPace) => {
  const short = words.filter((word) => word.length <= pace.maxWordLength);
  return short.length ? short : words;
};

/** A word to throw: one of `words` not falling on that side already (`falling`), else any of them. */
export const pickThrownWord = (words: string[], falling: Set<string>, rand: () => number) => {
  const free = words.filter((word) => !falling.has(word));
  const from = free.length ? free : words;
  return from[Math.min(from.length - 1, Math.floor(rand() * from.length))];
};

/** How long to wait before trying again when every lane is still busy. */
const RETRY_MS = 100;

/**
 * The rain of a whole match, the same for both players: words in the order given (wrapping around), each in a lane whose
 * newest word has fallen `laneGap` of its way, coming more often and falling faster as the match goes on.
 */
export const buildRainSchedule = (words: string[], rand: () => number, pace: RainPace): RainSpawn[] => {
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
    const spawn = { index, text: words[index % words.length], lane: free[Math.min(free.length - 1, Math.floor(rand() * free.length))], atMs, fallMs: fallMsAt(atMs, pace) };
    schedule.push(spawn);
    newest[spawn.lane] = spawn;
    atMs += spawnMsAt(atMs, pace);
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
