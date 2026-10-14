import { describe, expect, it } from 'vitest';
import { accuracyOf, checkWords, splitTyped, summarizeErrors } from './typing-session';

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
