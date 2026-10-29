// The practice rain duel against Ping-bot (Ping tutorial design): the rules of the ranked rain duel (one rain for both
// sides, a word typed in time throws another word to the other side, 3 lives) at the Bronze pace, run in the browser
// only. Nothing is sent to the ranked API and no rating changes. Pure, so it is tested without timers.
import { exact, laneX, loose } from '@/modules/rain/lib/rain-game';
import type { RainDrop } from '@/modules/rain/types/rain.types';

/** The Bronze pace of the ranked rain duel (`rainDuelSettings.paces.Bronze` on the server), and its fixed numbers. */
export const PRACTICE_PACE = {
  spawnFromMs: 2800,
  spawnToMs: 1600,
  fallFromMs: 9000,
  fallToMs: 6000,
  maxThrownFalling: 1,
  maxWordLength: 6,
  durationMs: 120_000,
  lives: 3,
  lanes: 6,
  laneGap: 0.3,
  thrownSpeedUp: 1.15,
};
/** A typed or landed word stays this long (its pop or splat), then it is removed. */
const SETTLE_MS = 600;
/** Missed words kept for Ping's tip (the coach takes at most 10). */
const MISSED_KEPT = 10;

type Rand = () => number;
export type SideKey = 'me' | 'bot';
export type PracticeResult = 'win' | 'loss' | 'draw';

export interface PracticeSpawn {
  text: string;
  lane: number;
  atMs: number;
  fallMs: number;
}
export interface PracticeDrop extends RainDrop {
  lane: number;
  /** Round time (ms) the word appeared; it lands at `bornAt + fallMs`. */
  bornAt: number;
  thrown: boolean;
  settledAt?: number;
  /** Ping-bot's side only: when it types this word, or `null` for a word it lets fall. */
  botAt?: number | null;
}
export interface PracticeSide {
  lives: number;
  hits: number;
  thrown: number;
  drops: PracticeDrop[];
  /** Thrown words waiting for a place (`maxThrownFalling`); each gets its word when it falls. */
  waiting: number;
}
export interface PracticeState {
  elapsed: number;
  schedule: PracticeSpawn[];
  next: number;
  words: string[];
  me: PracticeSide;
  bot: PracticeSide;
  /** What is in my typing box. */
  input: string;
  lastId: number;
  result: PracticeResult | null;
  /** My words that reached the ground, for Ping's tip. */
  missed: string[];
  /** The moments: a word thrown onto a side, a word landed, a word typed (round time, so a new one replays). */
  lastThrow?: { to: SideKey; text: string; at: number };
  lastLand?: { side: SideKey; at: number };
  lastHit?: { side: SideKey; at: number };
}
export type PracticeAction =
  | { type: 'tick'; dt: number; rand: Rand }
  /** I sent a word (space or Enter). */
  | { type: 'type'; text: string; rand: Rand }
  /** What is in my box changed (to mark the letters typed on the target). */
  | { type: 'input'; text: string };

const lerp = (from: number, to: number, elapsed: number) =>
  Math.round(from + (to - from) * Math.min(1, Math.max(0, elapsed / PRACTICE_PACE.durationMs)));
const fallAt = (elapsed: number) => lerp(PRACTICE_PACE.fallFromMs, PRACTICE_PACE.fallToMs, elapsed);
const spawnGapAt = (elapsed: number) => lerp(PRACTICE_PACE.spawnFromMs, PRACTICE_PACE.spawnToMs, elapsed);
const pick = <T,>(items: T[], rand: Rand) => items[Math.min(items.length - 1, Math.floor(rand() * items.length))];

/** When Ping-bot types a word that appeared at `spawnedAt`: one word in six it lets fall (`null`), else after 2.5–6 s. */
export const botPlan = (spawnedAt: number, rand: Rand): number | null => (rand() < 1 / 6 ? null : spawnedAt + 2500 + rand() * 3500);

/** A word to throw: one of `words` not falling on that side already, so it is a new word to type (else any). */
export const pickThrown = (words: string[], falling: Set<string>, rand: Rand) => {
  const free = words.filter((word) => !falling.has(word));
  return pick(free.length ? free : words, rand);
};

/** The end, from my side, or `null` while it goes on: no lives left loses (both at once: a draw); at the time, lives then words. */
export const duelOutcome = (me: { lives: number; hits: number }, bot: { lives: number; hits: number }, timeUp: boolean): PracticeResult | null => {
  if (me.lives <= 0 && bot.lives <= 0) return 'draw';
  if (me.lives <= 0) return 'loss';
  if (bot.lives <= 0) return 'win';
  if (!timeUp) return null;
  const order = me.lives - bot.lives || me.hits - bot.hits;
  return order > 0 ? 'win' : order < 0 ? 'loss' : 'draw';
};

/** The rain of the whole duel, the same for both sides: short words, each in a lane whose newest word has fallen a bit. */
/** The words of a duel at this pace: no longer than `maxWordLength` letters (all of them if none is that short). */
const shortWords = (words: string[]) => {
  const short = words.filter((word) => [...word].length <= PRACTICE_PACE.maxWordLength);
  return short.length ? short : words;
};

export const buildPracticeSchedule = (words: string[], rand: Rand): PracticeSpawn[] => {
  const list = shortWords(words);
  if (!list.length) return [];
  const newest: (PracticeSpawn | undefined)[] = Array.from({ length: PRACTICE_PACE.lanes });
  const schedule: PracticeSpawn[] = [];
  let atMs = 0;
  while (atMs <= PRACTICE_PACE.durationMs) {
    const free = newest.flatMap((spawn, lane) => (!spawn || atMs - spawn.atMs >= PRACTICE_PACE.laneGap * spawn.fallMs ? [lane] : []));
    if (!free.length) {
      atMs += 100;
      continue;
    }
    const spawn = { text: list[schedule.length % list.length], lane: pick(free, rand), atMs, fallMs: fallAt(atMs) };
    schedule.push(spawn);
    newest[spawn.lane] = spawn;
    atMs += spawnGapAt(atMs);
  }
  return schedule;
};

const side = (): PracticeSide => ({ lives: PRACTICE_PACE.lives, hits: 0, thrown: 0, drops: [], waiting: 0 });

/** A duel about to start: the words shuffled by the caller, the rain built from them. */
export const startPractice = (words: string[], rand: Rand): PracticeState => ({
  elapsed: 0,
  schedule: buildPracticeSchedule(words, rand),
  next: 0,
  words: shortWords(words),
  me: side(),
  bot: side(),
  input: '',
  lastId: 0,
  result: null,
  missed: [],
});

// The helpers below change a copy of the state that the reducer made (`structuredClone`).
const other = (key: SideKey): SideKey => (key === 'me' ? 'bot' : 'me');
const falling = (s: PracticeSide) => s.drops.filter((drop) => drop.state === 'falling');

const addDrop = (s: PracticeState, key: SideKey, text: string, lane: number, fallMs: number, thrown: boolean, rand: Rand) => {
  s.lastId += 1;
  s[key].drops.push({
    id: String(s.lastId),
    text,
    x: laneX(lane, PRACTICE_PACE.lanes),
    fallMs,
    typed: 0,
    state: 'falling',
    lane,
    bornAt: s.elapsed,
    thrown,
    ...(key === 'bot' && { botAt: botPlan(s.elapsed, rand) }),
  });
};

const throwTo = (s: PracticeState, key: SideKey, rand: Rand) => {
  const target = s[key];
  if (falling(target).filter((drop) => drop.thrown).length >= PRACTICE_PACE.maxThrownFalling) {
    target.waiting += 1;
    return;
  }
  const text = pickThrown(s.words, new Set(falling(target).map((drop) => drop.text)), rand);
  const counts = Array.from({ length: PRACTICE_PACE.lanes }, () => 0);
  falling(target).forEach((drop) => (counts[drop.lane] += 1));
  addDrop(s, key, text, counts.indexOf(Math.min(...counts)), Math.round(fallAt(s.elapsed) / PRACTICE_PACE.thrownSpeedUp), true, rand);
  s.lastThrow = { to: key, text, at: s.elapsed };
};

/** A thrown word left this side: the next one waiting falls. */
const release = (s: PracticeState, key: SideKey, rand: Rand) => {
  if (s[key].waiting === 0) return;
  s[key].waiting -= 1;
  throwTo(s, key, rand);
};

const hit = (s: PracticeState, key: SideKey, drop: PracticeDrop, rand: Rand) => {
  drop.state = 'popped';
  drop.settledAt = s.elapsed;
  s[key].hits += 1;
  s.lastHit = { side: key, at: s.elapsed };
  if (drop.thrown) release(s, key, rand);
  else {
    s[key].thrown += 1;
    throwTo(s, other(key), rand);
  }
};

const settle = (s: PracticeState) => {
  s.result = duelOutcome(s.me, s.bot, s.elapsed >= PRACTICE_PACE.durationMs);
};

const tick = (s: PracticeState, dt: number, rand: Rand) => {
  s.elapsed += dt;
  while (s.next < s.schedule.length && s.schedule[s.next].atMs <= s.elapsed) {
    const { text, lane, fallMs } = s.schedule[s.next];
    addDrop(s, 'me', text, lane, fallMs, false, rand);
    addDrop(s, 'bot', text, lane, fallMs, false, rand);
    s.next += 1;
  }
  for (const drop of falling(s.bot)) if (drop.botAt != null && drop.botAt <= s.elapsed) hit(s, 'bot', drop, rand);
  for (const key of ['me', 'bot'] as const)
    for (const drop of falling(s[key])) {
      if (drop.bornAt + drop.fallMs > s.elapsed) continue;
      drop.state = 'missed';
      drop.settledAt = s.elapsed;
      s[key].lives -= 1;
      s.lastLand = { side: key, at: s.elapsed };
      if (key === 'me') s.missed = [...s.missed, drop.text].slice(-MISSED_KEPT);
      if (drop.thrown) release(s, key, rand);
    }
  for (const key of ['me', 'bot'] as const) s[key].drops = s[key].drops.filter((drop) => drop.settledAt === undefined || s.elapsed - drop.settledAt < SETTLE_MS);
  settle(s);
};

/** My falling word that the box is the start of and that lands first: it shows the letters typed. */
const markTyped = (s: PracticeState) => {
  const typed = loose(s.input);
  const target = typed
    ? falling(s.me)
        .filter((drop) => loose(drop.text).startsWith(typed))
        .sort((a, b) => a.bornAt + a.fallMs - (b.bornAt + b.fallMs))[0]
    : undefined;
  s.me.drops.forEach((drop) => (drop.typed = drop === target ? typed.length : 0));
};

export const practiceReducer = (state: PracticeState, action: PracticeAction): PracticeState => {
  if (state.result) return state;
  const s = structuredClone(state);
  if (action.type === 'tick') tick(s, action.dt, action.rand);
  else if (action.type === 'input') s.input = action.text;
  else {
    const word = exact(action.text.trim());
    const drop = falling(s.me)
      .filter((candidate) => exact(candidate.text) === word)
      .sort((a, b) => a.bornAt + a.fallMs - (b.bornAt + b.fallMs))[0];
    if (drop) hit(s, 'me', drop, action.rand);
    s.input = '';
    settle(s);
  }
  markTyped(s);
  return s;
};
