import { describe, expect, it } from 'vitest';
import { accuracyOf, checkWords, formatDuration, splitTyped, statsFromCounts, summarizeErrors } from './typing-session';

describe('splitTyped', () => {
  it('keeps words followed by a space as done and the rest as current', () => {
    expect(splitTyped('Tiếng Việ')).toEqual({ done: ['Tiếng'], current: 'Việ' });
    expect(splitTyped('Tiếng ')).toEqual({ done: ['Tiếng'], current: '' });
    expect(splitTyped('')).toEqual({ done: [], current: '' });
  });

  it('ignores repeated and leading spaces', () => {
    expect(splitTyped('  Tiếng   Việt ')).toEqual({ done: ['Tiếng', 'Việt'], current: '' });
  });
});

describe('checkWords', () => {
  it('compares by position and ignores extra words', () => {
    const results = checkWords(['đi', 'học'], ['di', 'học', 'thừa']);
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ target: 'đi', typed: 'di', errors: ['D_MISSING'] });
    expect(results[1].errors).toEqual([]);
  });
});

describe('summarizeErrors and accuracyOf', () => {
  const results = checkWords(['đi', 'học', 'nghỉ'], ['di', 'học', 'nghĩ']);

  it('counts errors against their opportunities', () => {
    const stats = Object.fromEntries(summarizeErrors(results).map((s) => [s.type, s]));
    expect(stats.D_MISSING).toMatchObject({ count: 1, chances: 1 });
    expect(stats.HOI_NGA_CONFUSION).toMatchObject({ count: 1, chances: 1 });
    expect(stats.TONE_WRONG).toMatchObject({ count: 0, chances: 3 });
    expect(stats.MARK_WRONG).toBeUndefined();
  });

  it('gives the share of correct words', () => {
    expect(accuracyOf(results)).toBe(33);
    expect(accuracyOf([])).toBe(100);
  });
});

describe('the English rules (SCRUM-219)', () => {
  const results = checkWords(['The', 'cat,', 'sat'], ['the', 'cat', 'sta'], 'en');

  it('checks the words of an English session by the English set', () => {
    expect(results.map((result) => result.errors)).toEqual([['CASE_WRONG'], ['PUNCTUATION_WRONG'], ['LETTERS_SWAPPED']]);
    // The Vietnamese set would call all of them a wrong letter.
    expect(checkWords(['The'], ['the']).map((result) => result.errors)).toEqual([['BASE_LETTER']]);
  });

  it('counts the English types against their chances, never the Vietnamese ones', () => {
    const stats = Object.fromEntries(summarizeErrors(results, 'en').map((s) => [s.type, s]));
    expect(stats.CASE_WRONG).toMatchObject({ count: 1, chances: 3 });
    expect(stats.PUNCTUATION_WRONG).toMatchObject({ count: 1, chances: 1 });
    expect(stats.LETTERS_SWAPPED).toMatchObject({ count: 1, chances: 3 });
    expect(stats.TONE_WRONG).toBeUndefined();
  });

  it('reads the counts of an English session, which has no Vietnamese keys', () => {
    expect(statsFromCounts({ CASE_WRONG: 1, LETTER_EXTRA: 0 }, { CASE_WRONG: 3, LETTER_EXTRA: 3, LETTER_WRONG: 3 }, 'en')).toEqual([
      { type: 'LETTER_WRONG', count: 0, chances: 3 },
      { type: 'LETTER_EXTRA', count: 0, chances: 3 },
      { type: 'CASE_WRONG', count: 1, chances: 3 },
    ]);
  });
});

describe('formatDuration', () => {
  it('shows minutes and padded seconds', () => {
    expect(formatDuration(5)).toBe('0:05');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(600)).toBe('10:00');
  });
});

describe('statsFromCounts', () => {
  it('keeps only the error types that had a chance', () => {
    const errorCounts = { BASE_LETTER: 1, D_MISSING: 0, MARK_WRONG: 0, TONE_WRONG: 2, HOI_NGA_CONFUSION: 0 };
    const opportunityCounts = { BASE_LETTER: 5, D_MISSING: 0, MARK_WRONG: 0, TONE_WRONG: 5, HOI_NGA_CONFUSION: 1 };

    expect(statsFromCounts(errorCounts, opportunityCounts)).toEqual([
      { type: 'BASE_LETTER', count: 1, chances: 5 },
      { type: 'TONE_WRONG', count: 2, chances: 5 },
      { type: 'HOI_NGA_CONFUSION', count: 0, chances: 1 },
    ]);
  });
});
