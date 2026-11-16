import { describe, expect, it } from 'vitest';
import { completedAtOf, dayNumbersOf, pickDailyTasks, taskProgressOf } from '../../src/services/user-daily-tasks.service';

describe('pickDailyTasks', () => {
  const templates = ['a', 'b', 'c', 'd', 'e'];
  /** Always picks the first of the templates left, like `Math.random` answering 0. */
  const first = () => 0;
  /** Answers `values` in turn. */
  const answers = (...values: number[]) => () => values.shift()!;

  it('picks at random among the templates, never one twice', () => {
    expect(pickDailyTasks(templates, 3, first)).toEqual(['a', 'b', 'c']);
    // The last of the 5, the first of the 4 left, then the middle one of the 3 left.
    expect(pickDailyTasks(templates, 3, answers(0.999, 0, 0.5))).toEqual(['e', 'a', 'c']);
  });

  it('answers every template, in a random order, when there are fewer than the count', () => {
    expect(pickDailyTasks(templates.slice(0, 2), 5).sort()).toEqual(['a', 'b']);
  });

  it('answers nothing without a template', () => {
    expect(pickDailyTasks([], 3)).toEqual([]);
  });

  it('picks as many as the count and leaves the list it was given as it was', () => {
    for (let run = 0; run < 50; run += 1) {
      const picked = pickDailyTasks(templates, 3);
      expect(picked).toHaveLength(3);
      expect(new Set(picked).size).toBe(3);
    }
    expect(templates).toHaveLength(5);
  });
});

describe('dayNumbersOf', () => {
  it('counts the sessions, and takes the minigames as given', () => {
    expect(dayNumbersOf([])).toEqual({ sessions: 0, minigames: 0 });
    expect(dayNumbersOf([{}, {}, {}], 2)).toEqual({ sessions: 3, minigames: 2 });
  });
});

describe('taskProgressOf', () => {
  const numbers = { sessions: 2, minigames: 1 };

  it('measures a sessions task on the counted sessions', () => {
    expect(taskProgressOf({ type: 'sessions', target: 2 }, numbers)).toEqual({ progress: 2, completed: true });
    expect(taskProgressOf({ type: 'sessions', target: 3 }, numbers)).toEqual({ progress: 2, completed: false });
  });

  it('measures a minigames task on the minigames and duels finished', () => {
    expect(taskProgressOf({ type: 'minigames', target: 2 }, numbers)).toEqual({ progress: 1, completed: false });
    expect(taskProgressOf({ type: 'minigames', target: 2 }, { ...numbers, minigames: 2 })).toEqual({ progress: 2, completed: true });
  });

  it('reads a day stored before minigames existed as 0 minigames', () => {
    const old = { sessions: 2 } as { sessions: number; minigames: number };

    expect(taskProgressOf({ type: 'minigames', target: 1 }, old)).toEqual({ progress: 0, completed: false });
  });

  it('is 0 and not completed for both types on a day without a session', () => {
    for (const type of ['sessions', 'minigames'] as const) {
      expect(taskProgressOf({ type, target: 1 }, dayNumbersOf([]))).toEqual({ progress: 0, completed: false });
    }
  });
});

describe('completedAtOf', () => {
  const at = (time: string) => new Date(`2026-03-10T${time}:00.000Z`);
  const day = [{ completedAt: at('01:00') }, { completedAt: at('02:00') }, { completedAt: at('03:00') }];

  it('is the time of the nth counted session for a sessions task, and undefined with fewer', () => {
    expect(completedAtOf({ type: 'sessions', target: 2 }, day)).toEqual(at('02:00'));
    expect(completedAtOf({ type: 'sessions', target: 4 }, day)).toBeUndefined();
    expect(completedAtOf({ type: 'sessions', target: 1 }, [])).toBeUndefined();
  });

  it('is the time of the nth minigame for a minigames task, and undefined with fewer', () => {
    const times = [at('01:30'), at('02:30'), at('03:30')];

    expect(completedAtOf({ type: 'minigames', target: 2 }, day, times)).toEqual(at('02:30'));
    expect(completedAtOf({ type: 'minigames', target: 2 }, day, [at('01:30')])).toBeUndefined();
    expect(completedAtOf({ type: 'minigames', target: 1 }, day)).toBeUndefined();
  });
});
