import { MAX_REPLAY_BYTES } from '../typing.config';
import type { ReplayEvent } from '../types/typing.types';
import { splitTyped } from './typing-session';

/**
 * The replay of a typing session (SCRUM-35). The typing area records what the learner sees, change by change
 * (`createReplayRecorder`); the replay player plays it back (`decodeReplay`, `replayTextAt`) and marks where the learner
 * hesitated (`findHesitations`). Each change is a small diff of the text, whatever the input method: Unikey and EVKey type
 * a mark as backspaces and new letters, the input methods of Windows, macOS and phones compose a word and then commit it.
 */

/** What the replay shows at one moment: the text on screen, and the text as last committed (its finished words are graded). */
export interface ReplayText {
  shown: string;
  committed: string;
}

const EMPTY: ReplayText = { shown: '', committed: '' };

/**
 * A change this soon after the one before comes from the same key: Unikey and EVKey send the backspaces and new letters of
 * a mark one after the other, each a few ms after the last (more on a slow computer, which draws the passage in between).
 */
const SAME_KEY_MS = 15;

const isHighSurrogate = (code: number) => code >= 0xd800 && code <= 0xdbff;
const isLowSurrogate = (code: number) => code >= 0xdc00 && code <= 0xdfff;

/** The smallest change that turns `before` into `after`: where it starts, how many characters it removes, what it puts there. */
export const diffText = (before: string, after: string) => {
  let at = 0;
  while (at < before.length && at < after.length && before[at] === after[at]) at += 1;
  // Characters left as they were at the end.
  let kept = 0;
  while (kept < before.length - at && kept < after.length - at && before.at(-1 - kept) === after.at(-1 - kept)) kept += 1;
  // Never cut an emoji (two UTF-16 units) in two: half of one cannot be saved as text.
  if (at > 0 && isHighSurrogate(before.charCodeAt(at - 1))) at -= 1;
  if (kept > 0 && isLowSurrogate(before.charCodeAt(before.length - kept))) kept -= 1;
  return { at, removed: before.length - at - kept, inserted: after.slice(at, after.length - kept) };
};

/**
 * Records a replay while the learner types: `record` after every input with the text on screen, `finish` at the end of the
 * session. The times are in ms after the first key.
 */
export const createReplayRecorder = () => {
  const events: ReplayEvent[] = [];
  let text = EMPTY;
  // The text before the last event, so that the next change of the same key is put into it.
  let beforeLast = EMPTY;
  // When the last event started, and when its last change was.
  let lastMs = 0;
  let lastChangeMs = 0;

  return {
    /** The learner now sees `shown`; `committed`: the input method has committed it, so its finished words are graded. */
    record(shown: string, committed: boolean, atMs: number) {
      if (shown === text.shown && (!committed || shown === text.committed)) return;
      const last = events.at(-1);
      // A commit can join the change before it; a change still composing only joins another one still composing.
      const sameKey = last !== undefined && atMs - lastChangeMs < SAME_KEY_MS && (committed || last.length === 5);
      const { at, removed, inserted } = diffText((sameKey ? beforeLast : text).shown, shown);
      // The clock of the computer can be set back: a time never goes back in the replay.
      const dt = sameKey ? last[0] : Math.max(0, atMs - lastMs);
      const event: ReplayEvent = committed ? [dt, at, removed, inserted] : [dt, at, removed, inserted, 1];
      if (sameKey) {
        events[events.length - 1] = event;
      } else {
        events.push(event);
        beforeLast = text;
        lastMs = Math.max(lastMs, atMs);
      }
      lastChangeMs = Math.max(lastChangeMs, atMs);
      text = { shown, committed: committed ? shown : text.committed };
    },
    /** The replay, with the time from the last change to the end (`atMs`); nothing when it is too big to send (`MAX_REPLAY_BYTES`). */
    finish(atMs: number): ReplayEvent[] | undefined {
      if (atMs > lastChangeMs) {
        events.push([atMs - lastMs, text.shown.length, 0, '', 1]);
        lastMs = lastChangeMs = atMs;
      }
      const bytes = new TextEncoder().encode(JSON.stringify(events)).length;
      return events.length > 0 && bytes <= MAX_REPLAY_BYTES ? events : undefined;
    },
  };
};

/** The text is kept after every this many changes, so a moment of the replay is found without applying every change from the start. */
const CHECKPOINT_EVERY = 100;

/** A replay ready to play. */
export interface DecodedReplay {
  events: ReplayEvent[];
  /** When each change happened, in ms after the first key. */
  times: number[];
  /** The end of the replay: the time of the last change (or of the end of the session). */
  durationMs: number;
  /** The text after 0, `CHECKPOINT_EVERY`, 2 × `CHECKPOINT_EVERY`… changes. */
  checkpoints: ReplayText[];
}

const apply = ({ shown, committed }: ReplayText, [, at, removed, inserted, composing]: ReplayEvent): ReplayText => {
  const next = shown.slice(0, at) + inserted + shown.slice(at + removed);
  return { shown: next, committed: composing ? committed : next };
};

export const decodeReplay = (events: ReplayEvent[]): DecodedReplay => {
  const times: number[] = [];
  const checkpoints = [EMPTY];
  let text = EMPTY;
  let time = 0;
  events.forEach((event, index) => {
    time += event[0];
    times.push(time);
    text = apply(text, event);
    if ((index + 1) % CHECKPOINT_EVERY === 0) checkpoints.push(text);
  });
  return { events, times, durationMs: time, checkpoints };
};

/** What the replay shows `ms` after the first key: the text after every change made by then. */
export const replayTextAt = ({ events, times, checkpoints }: DecodedReplay, ms: number): ReplayText => {
  const later = times.findIndex((time) => time > ms);
  const count = later === -1 ? events.length : later;
  const from = Math.floor(count / CHECKPOINT_EVERY);
  return events.slice(from * CHECKPOINT_EVERY, count).reduce(apply, checkpoints[from]);
};

/** A pause shorter than this is never a hesitation, whatever the learner's pace. */
export const HESITATION_MIN_MS = 1000;
/** A hesitation is also at least this many times the learner's usual pause between two changes (the median). */
export const HESITATION_FACTOR = 3;

/** A place where the learner stopped typing for a while ("chỗ khựng"). */
export interface Hesitation {
  /** When they stopped, in ms after the first key. */
  atMs: number;
  /** How long they stopped. */
  ms: number;
  /** The word they were typing, or about to type after a space: its index in the passage. */
  wordIndex: number;
}

const changesText = ([, , removed, inserted]: ReplayEvent) => removed > 0 || inserted !== '';

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;

/**
 * Where the learner hesitated: the pauses before a change of the text that last at least `HESITATION_MIN_MS` and
 * `HESITATION_FACTOR` times their usual pause, so a slow typist is not marked at every word. The time after the last change
 * (until the time was up) is not one: nothing was typed after it. `thresholdMs` is the shortest pause marked in this replay.
 */
export const findHesitations = (replay: DecodedReplay) => {
  const typed = replay.events.flatMap((event, index) => (changesText(event) ? [{ ms: event[0], index }] : []));
  const thresholdMs = Math.max(HESITATION_MIN_MS, HESITATION_FACTOR * median(typed.map(({ ms }) => ms)));
  const hesitations: Hesitation[] = typed
    .filter(({ ms }) => ms >= thresholdMs)
    .map(({ ms, index }) => {
      const atMs = replay.times[index] - ms;
      return { atMs, ms, wordIndex: splitTyped(replayTextAt(replay, atMs).shown).done.length };
    });
  return { thresholdMs, hesitations };
};
