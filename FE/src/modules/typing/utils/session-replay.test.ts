import { describe, expect, it } from 'vitest';
import { MAX_REPLAY_BYTES } from '../typing.config';
import type { ReplayEvent } from '../types/typing.types';
import { createReplayRecorder, decodeReplay, diffText, findHesitations, replayTextAt } from './session-replay';

describe('diffText', () => {
  it('finds the smallest change: letters added or removed at the end, a mark replacing a letter, an edit in the middle', () => {
    expect(diffText('Tiê', 'Tiên')).toEqual({ at: 3, removed: 0, inserted: 'n' });
    expect(diffText('Tiên', 'Tiê')).toEqual({ at: 3, removed: 1, inserted: '' });
    expect(diffText('Tiêng', 'Tiếng')).toEqual({ at: 2, removed: 1, inserted: 'ế' });
    expect(diffText('ab cd', 'ab xcd')).toEqual({ at: 3, removed: 0, inserted: 'x' });
    expect(diffText('same', 'same')).toEqual({ at: 4, removed: 0, inserted: '' });
  });

  it('never cuts an emoji in two', () => {
    expect(diffText('a😀', 'a😃')).toEqual({ at: 1, removed: 2, inserted: '😃' });
    // The same second half, another first half.
    expect(diffText('😀', '🈀')).toEqual({ at: 0, removed: 2, inserted: '🈀' });
  });
});

describe('createReplayRecorder', () => {
  it('records each change with the ms since the previous one, and marks the changes still composing', () => {
    const recorder = createReplayRecorder();
    recorder.record('T', true, 0);
    recorder.record('Ti', true, 120);
    recorder.record('Tiê', false, 300);
    recorder.record('Tiên', false, 420);
    recorder.record('Tiên', true, 600); // committed, no new letter

    expect(recorder.finish(600)).toEqual([
      [0, 0, 0, 'T'],
      [120, 1, 0, 'i'],
      [180, 2, 0, 'ê', 1],
      [120, 3, 0, 'n', 1],
      [180, 4, 0, ''],
    ]);
  });

  it('puts the backspaces and new letters Unikey sends for one key into one change, however long they take in all', () => {
    const recorder = createReplayRecorder();
    recorder.record('Tiêng', true, 0);
    // "s" on "Tiêng": three backspaces, then "ếng", 6 ms apart (30 ms in all) on a slow computer.
    ['Tiên', 'Tiê', 'Ti', 'Tiế', 'Tiến', 'Tiếng'].forEach((text, index) => recorder.record(text, true, 400 + index * 6));

    expect(recorder.finish(430)).toEqual([
      [0, 0, 0, 'Tiêng'],
      [400, 2, 1, 'ế'],
    ]);
  });

  it('keeps two keys apart when the second comes 15 ms or more after the first', () => {
    const recorder = createReplayRecorder();
    recorder.record('a', true, 100);
    recorder.record('ab', true, 114); // the same key
    recorder.record('abc', true, 129); // the next one

    expect(recorder.finish(129)).toEqual([
      [100, 0, 0, 'ab'],
      [29, 2, 0, 'c'],
    ]);
  });

  it('lets a commit join the change composed just before it, but keeps a commit apart from what is composed after it', () => {
    const recorder = createReplayRecorder();
    recorder.record('Tiếng', false, 0);
    recorder.record('Tiếng', true, 500); // the input method commits the word...
    recorder.record('Tiếng ', true, 502); // ...with the space
    recorder.record('Tiếng V', false, 505); // the next word starts composing at once

    expect(recorder.finish(505)).toEqual([
      [0, 0, 0, 'Tiếng', 1],
      [500, 5, 0, ' '],
      [5, 6, 0, 'V', 1],
    ]);
  });

  it('records nothing when the text and what is committed stay the same, and never goes back in time', () => {
    const recorder = createReplayRecorder();
    recorder.record('a', true, 100);
    recorder.record('a', true, 200);
    recorder.record('a', false, 300);
    recorder.record('ab', true, 50); // the computer's clock was set back: "b" joins the last change

    expect(recorder.finish(0)).toEqual([[100, 0, 0, 'ab']]);
  });

  it('ends with the time from the last change to the end, without a change and without grading anything', () => {
    const recorder = createReplayRecorder();
    recorder.record('Tiếng V', true, 1000);

    const events = recorder.finish(20_000)!;

    expect(events.at(-1)).toEqual([19_000, 7, 0, '', 1]);
    expect(replayTextAt(decodeReplay(events), 20_000)).toEqual({ shown: 'Tiếng V', committed: 'Tiếng V' });
  });

  it('gives no replay when it is bigger than the server keeps', () => {
    const fits = createReplayRecorder();
    // `[[0,0,0,"…"]]` is 12 bytes around the text.
    fits.record('a'.repeat(MAX_REPLAY_BYTES - 12), true, 0);
    expect(fits.finish(0)).toHaveLength(1);

    const tooBig = createReplayRecorder();
    tooBig.record('a'.repeat(MAX_REPLAY_BYTES - 11), true, 0);
    expect(tooBig.finish(0)).toBeUndefined();
  });
});

describe('decodeReplay and replayTextAt', () => {
  const events: ReplayEvent[] = [
    [0, 0, 0, 'T'],
    [100, 1, 0, 'i'],
    [100, 2, 0, 'ê', 1],
    [100, 3, 0, 'n', 1],
    [100, 4, 0, ' '],
    [1000, 5, 0, '', 1],
  ];

  it('knows when each change happened and how long the replay lasts', () => {
    const replay = decodeReplay(events);

    expect(replay.times).toEqual([0, 100, 200, 300, 400, 1400]);
    expect(replay.durationMs).toBe(1400);
  });

  it('shows the text after the changes made by a moment, the committed part apart', () => {
    const replay = decodeReplay(events);

    expect(replayTextAt(replay, -1)).toEqual({ shown: '', committed: '' });
    expect(replayTextAt(replay, 0)).toEqual({ shown: 'T', committed: 'T' });
    expect(replayTextAt(replay, 150)).toEqual({ shown: 'Ti', committed: 'Ti' });
    expect(replayTextAt(replay, 300)).toEqual({ shown: 'Tiên', committed: 'Ti' }); // still composing
    expect(replayTextAt(replay, 400)).toEqual({ shown: 'Tiên ', committed: 'Tiên ' });
    expect(replayTextAt(replay, Infinity)).toEqual({ shown: 'Tiên ', committed: 'Tiên ' });
  });

  it('finds the same text from its checkpoints as by applying every change from the start', () => {
    // 250 letters, then all of them deleted one by one, with a change in the middle on the way.
    const typing: ReplayEvent[] = [];
    for (let i = 0; i < 250; i += 1) typing.push([10, i, 0, String.fromCharCode(97 + (i % 26))]);
    typing.push([10, 3, 1, 'X']);
    for (let i = 249; i >= 0; i -= 1) typing.push([10, i, 1, '']);
    const replay = decodeReplay(typing);
    let shown = '';

    typing.forEach(([, at, removed, inserted], index) => {
      shown = shown.slice(0, at) + inserted + shown.slice(at + removed);
      expect(replayTextAt(replay, (index + 1) * 10).shown).toBe(shown);
    });
    expect(replay.checkpoints).toHaveLength(6); // after 0, 100, ..., 500 changes
  });
});

describe('findHesitations', () => {
  it('marks the stops of at least 1 second and 3 times the usual pause, on the word being typed', () => {
    const events: ReplayEvent[] = [
      [0, 0, 0, 'a'],
      [200, 1, 0, ' '],
      [1500, 2, 0, 'b'], // a stop before the second word
      [200, 3, 0, 'b'],
      [900, 4, 0, ' '], // under a second
      [200, 5, 0, 'c'],
      [2500, 6, 0, 'c'], // a stop in the middle of the third word
      [5000, 7, 0, '', 1], // the time after the last change, until the end
    ];

    const { thresholdMs, hesitations } = findHesitations(decodeReplay(events));

    expect(thresholdMs).toBe(1000);
    expect(hesitations).toEqual([
      { atMs: 200, ms: 1500, wordIndex: 1 },
      { atMs: 3000, ms: 2500, wordIndex: 2 },
    ]);
  });

  it('asks more of a slow typist, whose usual pause is longer', () => {
    const slow: ReplayEvent[] = [[0, 0, 0, 'a'], ...Array.from({ length: 6 }, (_, i): ReplayEvent => [600, i + 1, 0, 'a']), [1500, 7, 0, 'a'], [2000, 8, 0, 'a']];

    const { thresholdMs, hesitations } = findHesitations(decodeReplay(slow));

    expect(thresholdMs).toBe(1800); // 3 × 600
    expect(hesitations.map((pause) => pause.ms)).toEqual([2000]);
  });
});
