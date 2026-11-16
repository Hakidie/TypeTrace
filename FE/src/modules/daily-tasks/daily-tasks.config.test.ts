import { describe, expect, it } from 'vitest';
import { goalOf } from './daily-tasks.config';

describe('goalOf', () => {
  it('says what each type of task asks', () => {
    expect(goalOf({ type: 'sessions', target: 1 })).toBe('Finish 1 counted session');
    expect(goalOf({ type: 'sessions', target: 3 })).toBe('Finish 3 counted sessions');
    expect(goalOf({ type: 'minigames', target: 1 })).toBe('Finish 1 minigame');
    expect(goalOf({ type: 'minigames', target: 3 })).toBe('Finish 3 minigames');
  });
});
