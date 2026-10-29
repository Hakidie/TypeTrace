import { describe, expect, it } from 'vitest';
import type { WordErrorType } from '@/shared/lib/vietnamese-errors';
import { goalOf } from './daily-tasks.config';

describe('goalOf', () => {
  it('says what each type of task asks', () => {
    expect(goalOf({ type: 'sessions', target: 1 })).toBe('Finish 1 counted session');
    expect(goalOf({ type: 'sessions', target: 3 })).toBe('Finish 3 counted sessions');
    expect(goalOf({ type: 'minutes', target: 15 })).toBe('Type 15 minutes in all');
    expect(goalOf({ type: 'wpm', target: 40 })).toBe('Reach 40 WPM in one session');
    expect(goalOf({ type: 'accuracy', target: 90, errorType: null })).toBe('Reach 90% accuracy in one session');
  });

  it('names the focus of an accuracy task, and the 5 words a session needs when only some words are a chance of it', () => {
    const focusGoal = (errorType: WordErrorType) => goalOf({ type: 'accuracy', target: 90, errorType });

    // Every word is a chance of these, and a counted session has at least 20 words.
    expect(focusGoal('BASE_LETTER')).toBe('Reach 90% accuracy on letters in one session');
    expect(focusGoal('TONE_WRONG')).toBe('Reach 90% accuracy on tone marks in one session');
    // Only some words are: a session counts for the task with 5 of them.
    expect(focusGoal('D_MISSING')).toBe('Reach 90% accuracy on the đ stroke in a session with at least 5 words with đ');
    expect(focusGoal('MARK_WRONG')).toBe('Reach 90% accuracy on vowel marks in a session with at least 5 words with vowel marks');
    expect(focusGoal('HOI_NGA_CONFUSION')).toBe('Reach 90% accuracy on hỏi and ngã in a session with at least 5 words with hỏi or ngã');
  });

  it('leaves out a focus on the other types', () => {
    expect(goalOf({ type: 'wpm', target: 40, errorType: 'HOI_NGA_CONFUSION' })).toBe('Reach 40 WPM in one session');
  });
});
