import { describe, expect, it } from 'vitest';
import type { ErrorCounts } from '../../src/models/typing-session.model';
import {
  completedAtOf,
  dayNumbersOf,
  MIN_FOCUS_CHANCES,
  MIN_WEAKNESS_CHANCES,
  pickDailyTasks,
  rankWeakErrorTypes,
  taskProgressOf
} from '../../src/services/user-daily-tasks.service';
import type { WordErrorType } from '../../src/utils/vietnamese-errors';

/** Counts of every error type: 0 but the ones given. */
const counts = (values: Partial<ErrorCounts> = {}): ErrorCounts => ({
  BASE_LETTER: 0,
  D_MISSING: 0,
  MARK_WRONG: 0,
  TONE_WRONG: 0,
  HOI_NGA_CONFUSION: 0,
  ...values
});

describe('rankWeakErrorTypes', () => {
  it('ranks the weak types by error rate, weakest first', () => {
    const errors = counts({ BASE_LETTER: 2, TONE_WRONG: 6, HOI_NGA_CONFUSION: 5 });
    const chances = counts({ BASE_LETTER: 100, TONE_WRONG: 100, HOI_NGA_CONFUSION: 10 });

    expect(rankWeakErrorTypes(errors, chances)).toEqual(['HOI_NGA_CONFUSION', 'TONE_WRONG', 'BASE_LETTER']);
  });

  it('leaves out a type with fewer than 10 chances, even with errors, and a type without an error', () => {
    const errors = counts({ D_MISSING: 9, MARK_WRONG: 0, HOI_NGA_CONFUSION: 1 });
    const chances = counts({ D_MISSING: MIN_WEAKNESS_CHANCES - 1, MARK_WRONG: 50, HOI_NGA_CONFUSION: MIN_WEAKNESS_CHANCES });

    expect(rankWeakErrorTypes(errors, chances)).toEqual(['HOI_NGA_CONFUSION']);
  });

  it('is empty for a learner without a session', () => {
    expect(rankWeakErrorTypes(counts(), counts())).toEqual([]);
  });

  it('gives a tie on the rate to the type with more errors, then to the order of WordError', () => {
    // 10 % each: 4 errors in 40 chances come before 1 in 10.
    expect(rankWeakErrorTypes(counts({ BASE_LETTER: 1, TONE_WRONG: 4 }), counts({ BASE_LETTER: 10, TONE_WRONG: 40 }))).toEqual([
      'TONE_WRONG',
      'BASE_LETTER'
    ]);
    // 10 % and 2 errors each: MARK_WRONG comes before HOI_NGA_CONFUSION in WordError.
    expect(
      rankWeakErrorTypes(counts({ HOI_NGA_CONFUSION: 2, MARK_WRONG: 2 }), counts({ HOI_NGA_CONFUSION: 20, MARK_WRONG: 20 }))
    ).toEqual(['MARK_WRONG', 'HOI_NGA_CONFUSION']);
  });
});

describe('pickDailyTasks', () => {
  /** A template: its `name` stands for the rest of it. */
  const template = (name: string, errorType?: WordErrorType) => ({ name, ...(errorType && { errorType }) });
  const templates = [
    template('sessions'),
    template('minutes'),
    template('wpm'),
    template('accuracy'),
    template('tone', 'TONE_WRONG'),
    template('hoi-nga 1', 'HOI_NGA_CONFUSION'),
    template('hoi-nga 2', 'HOI_NGA_CONFUSION')
  ];
  const names = (picked: { name: string }[]) => picked.map((task) => task.name);
  /** Always picks the first of the templates left, like `Math.random` answering 0. */
  const first = () => 0;
  /** Always picks the last of them (`Math.random` stays below 1). */
  const last = () => 0.999;
  /** Answers `values` in turn. */
  const answers = (...values: number[]) => () => values.shift()!;

  it('picks first a template that focuses on each weak type, in their order, then fills the places left at random', () => {
    expect(names(pickDailyTasks(templates, ['HOI_NGA_CONFUSION', 'TONE_WRONG'], 4, first))).toEqual([
      'hoi-nga 1',
      'tone',
      'sessions',
      'minutes'
    ]);
  });

  it('takes one template per weak type, at random among the ones that focus on it', () => {
    expect(names(pickDailyTasks(templates, ['HOI_NGA_CONFUSION'], 3, first))).toEqual(['hoi-nga 1', 'sessions', 'minutes']);
    expect(names(pickDailyTasks(templates, ['HOI_NGA_CONFUSION'], 1, last))).toEqual(['hoi-nga 2']);
  });

  it('skips a weak type that no template focuses on', () => {
    expect(names(pickDailyTasks(templates, ['D_MISSING', 'TONE_WRONG'], 2, first))).toEqual(['tone', 'sessions']);
  });

  it('stops at the count, also among the weak types', () => {
    expect(names(pickDailyTasks(templates, ['HOI_NGA_CONFUSION', 'TONE_WRONG'], 1, first))).toEqual(['hoi-nga 1']);
  });

  it('picks at random among all the templates for a learner without a weak type', () => {
    // The last of the 7, the first of the 6 left, then the middle one of the 5 left.
    expect(names(pickDailyTasks(templates, [], 3, answers(0.999, 0, 0.5)))).toEqual(['hoi-nga 2', 'sessions', 'accuracy']);
  });

  it('answers every template, in a random order, when there are fewer than the count', () => {
    const picked = pickDailyTasks(templates.slice(0, 3), ['HOI_NGA_CONFUSION'], 5);

    expect(names(picked).sort()).toEqual(['minutes', 'sessions', 'wpm']);
  });

  it('answers nothing without a template', () => {
    expect(pickDailyTasks([], ['HOI_NGA_CONFUSION'], 3)).toEqual([]);
  });

  it('never picks a template twice and leaves the list it was given as it was', () => {
    for (let run = 0; run < 50; run += 1) {
      for (const count of [3, templates.length]) {
        const picked = pickDailyTasks(templates, ['TONE_WRONG', 'HOI_NGA_CONFUSION'], count);
        expect(picked).toHaveLength(count);
        expect(new Set(picked).size).toBe(count);
      }
    }
    expect(templates).toHaveLength(7);
  });
});

describe('dayNumbersOf', () => {
  it('is all zeros for a day without a session', () => {
    expect(dayNumbersOf([])).toEqual({ sessions: 0, durationMs: 0, bestWpm: 0, bestAccuracy: 0, bestErrorAccuracy: {} });
  });

  it('counts the sessions, adds up their time and keeps the best WPM and the best accuracy of one session', () => {
    const sessions = [
      { durationMs: 60_000, wpm: 30, accuracy: 98 },
      { durationMs: 90_500, wpm: 42.5, accuracy: 91.2 },
      { durationMs: 30_000, wpm: 12, accuracy: 100 }
    ];

    expect(dayNumbersOf(sessions)).toEqual({ sessions: 3, durationMs: 180_500, bestWpm: 42.5, bestAccuracy: 100, bestErrorAccuracy: {} });
  });

  it('counts a field a session lacks as 0', () => {
    expect(dayNumbersOf([{}, { wpm: 20 }, { opportunityCounts: counts({ TONE_WRONG: 8 }) }])).toEqual({
      sessions: 3,
      durationMs: 0,
      bestWpm: 20,
      bestAccuracy: 0,
      // Chances without error counts: no error.
      bestErrorAccuracy: { TONE_WRONG: 100 }
    });
  });

  it('keeps for each error type the best accuracy on it of one session with at least 5 chances of it', () => {
    const numbers = dayNumbersOf([
      // 4 chances of a hỏi/ngã mix-up: too few, even without an error.
      { errorCounts: counts(), opportunityCounts: counts({ HOI_NGA_CONFUSION: MIN_FOCUS_CHANCES - 1, TONE_WRONG: 20 }) },
      // 1 mix-up in 5 chances: 80 %; 1 wrong tone in 20: 95 %.
      {
        errorCounts: counts({ HOI_NGA_CONFUSION: 1, TONE_WRONG: 1 }),
        opportunityCounts: counts({ HOI_NGA_CONFUSION: MIN_FOCUS_CHANCES, TONE_WRONG: 20 })
      },
      // 1 mix-up in 7 chances: 85.7 %, to one decimal.
      { errorCounts: counts({ HOI_NGA_CONFUSION: 1 }), opportunityCounts: counts({ HOI_NGA_CONFUSION: 7 }) }
    ]);

    expect(numbers.bestErrorAccuracy).toEqual({ HOI_NGA_CONFUSION: 85.7, TONE_WRONG: 100 });
  });

  it('never goes below 0 on an error type with more errors than chances', () => {
    // A word without a vowel mark typed with one is a MARK_WRONG error the word gave no chance of.
    const numbers = dayNumbersOf([{ errorCounts: counts({ MARK_WRONG: 7 }), opportunityCounts: counts({ MARK_WRONG: 5 }) }]);

    expect(numbers.bestErrorAccuracy).toEqual({ MARK_WRONG: 0 });
  });
});

describe('taskProgressOf', () => {
  const numbers = { sessions: 2, durationMs: 359_999, bestWpm: 41.5, bestAccuracy: 96.4, bestErrorAccuracy: { HOI_NGA_CONFUSION: 85.5 } };

  it('counts the sessions of a sessions task', () => {
    expect(taskProgressOf({ type: 'sessions', target: 2 }, numbers)).toEqual({ progress: 2, completed: true });
    expect(taskProgressOf({ type: 'sessions', target: 3 }, numbers)).toEqual({ progress: 2, completed: false });
  });

  it('shows the minutes with one decimal rounded down, and completes a minutes task at the exact millisecond', () => {
    // 359 999 ms is 5.99998 minutes: 5.9, not yet 6.
    expect(taskProgressOf({ type: 'minutes', target: 6 }, numbers)).toEqual({ progress: 5.9, completed: false });
    expect(taskProgressOf({ type: 'minutes', target: 6 }, { ...numbers, durationMs: 360_000 })).toEqual({ progress: 6, completed: true });
    expect(taskProgressOf({ type: 'minutes', target: 5 }, numbers)).toEqual({ progress: 5.9, completed: true });
    expect(taskProgressOf({ type: 'minutes', target: 1 }, { ...numbers, durationMs: 5_999 })).toEqual({ progress: 0, completed: false });
  });

  it('takes the best WPM of one session for a wpm task', () => {
    expect(taskProgressOf({ type: 'wpm', target: 41 }, numbers)).toEqual({ progress: 41.5, completed: true });
    expect(taskProgressOf({ type: 'wpm', target: 42 }, numbers)).toEqual({ progress: 41.5, completed: false });
  });

  it('takes the best accuracy of one session for an accuracy task, on its error type alone when it has one', () => {
    expect(taskProgressOf({ type: 'accuracy', target: 96 }, numbers)).toEqual({ progress: 96.4, completed: true });
    expect(taskProgressOf({ type: 'accuracy', target: 97 }, numbers)).toEqual({ progress: 96.4, completed: false });
    expect(taskProgressOf({ type: 'accuracy', target: 85, errorType: 'HOI_NGA_CONFUSION' }, numbers)).toEqual({
      progress: 85.5,
      completed: true
    });
    expect(taskProgressOf({ type: 'accuracy', target: 90, errorType: 'HOI_NGA_CONFUSION' }, numbers)).toEqual({
      progress: 85.5,
      completed: false
    });
  });

  it('is 0 on a focused error type until a session has enough chances of it', () => {
    expect(taskProgressOf({ type: 'accuracy', target: 90, errorType: 'TONE_WRONG' }, numbers)).toEqual({
      progress: 0,
      completed: false
    });
  });

  it('is 0 and not completed for every type on a day without a session', () => {
    const empty = dayNumbersOf([]);

    for (const type of ['sessions', 'minutes', 'wpm', 'accuracy'] as const) {
      expect(taskProgressOf({ type, target: 1 }, empty)).toEqual({ progress: 0, completed: false });
    }
  });
});

describe('completedAtOf', () => {
  const at = (time: string) => new Date(`2026-03-10T${time}:00.000Z`);
  const day = [
    { completedAt: at('01:00'), durationMs: 50_000, wpm: 30, accuracy: 90 },
    { completedAt: at('02:00'), durationMs: 40_000, wpm: 45, accuracy: 99 },
    { completedAt: at('03:00'), durationMs: 60_000, wpm: 20, accuracy: 100 }
  ];

  it('is the time of the session that first brings the task to its target, added up like the day', () => {
    expect(completedAtOf({ type: 'sessions', target: 2 }, day)).toEqual(at('02:00'));
    // 50 s, then 90 s: one and a half minutes only with the second session.
    expect(completedAtOf({ type: 'minutes', target: 1 }, day)).toEqual(at('02:00'));
    expect(completedAtOf({ type: 'wpm', target: 30 }, day)).toEqual(at('01:00'));
    expect(completedAtOf({ type: 'accuracy', target: 100 }, day)).toEqual(at('03:00'));
  });

  it('keeps the first time: a later session past the target changes nothing', () => {
    expect(completedAtOf({ type: 'wpm', target: 40 }, day)).toEqual(at('02:00'));
  });

  it('is undefined when the sessions of the day never reach the target', () => {
    expect(completedAtOf({ type: 'sessions', target: 4 }, day)).toBeUndefined();
    expect(completedAtOf({ type: 'wpm', target: 50 }, [])).toBeUndefined();
  });

  it('counts a focused accuracy task only from a session with enough chances of its error type', () => {
    const focused = [
      // Every tone right, but too few chances to count.
      { completedAt: at('01:00'), errorCounts: counts(), opportunityCounts: counts({ TONE_WRONG: MIN_FOCUS_CHANCES - 1 }) },
      { completedAt: at('02:00'), errorCounts: counts({ TONE_WRONG: 1 }), opportunityCounts: counts({ TONE_WRONG: 20 }) }
    ];

    expect(completedAtOf({ type: 'accuracy', target: 95, errorType: 'TONE_WRONG' }, focused)).toEqual(at('02:00'));
  });
});
