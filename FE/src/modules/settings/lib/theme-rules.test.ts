import { describe, expect, it } from 'vitest';
import { fallbackThemes } from '@/shared/lib/theme';
import { contrastRatio, isDarkBackground, themeProblems } from './theme-rules';

const midnight = { background: '#0b1020', text: '#e6ebff', muted: '#8f9bc9', accent: '#6d8bff' };

// The same sample colors as BE/tests/unit/theme-colors.test.ts: the two copies of the rules must agree.
describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for the same color', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#336699', '#336699')).toBe(1);
  });
});

describe('isDarkBackground', () => {
  it('tells dark backgrounds from light ones', () => {
    expect(isDarkBackground('#0b1020')).toBe(true);
    expect(isDarkBackground('#140606')).toBe(true);
    expect(isDarkBackground('#ffffff')).toBe(false);
    expect(isDarkBackground('#f4ead8')).toBe(false);
  });
});

describe('themeProblems', () => {
  it('is empty for a readable theme that fits the mode', () => {
    expect(themeProblems('dark', midnight)).toEqual([]);
  });

  it('rejects a background of the other mode', () => {
    expect(themeProblems('light', midnight)[0]).toMatchObject({ field: 'background', message: 'The background is too dark for Light mode.' });
    expect(themeProblems('dark', { ...midnight, background: '#ffffff', text: '#111111', muted: '#777777', accent: '#555555' })[0]).toMatchObject({
      field: 'background',
      message: 'The background is too light for Dark mode.',
    });
  });

  it('names each color that is hard to read, with its ratio', () => {
    const problems = themeProblems('dark', { ...midnight, text: '#222a44', accent: '#10182e' });

    expect(problems.map((problem) => problem.field)).toEqual(['text', 'accent']);
    expect(problems[0].message).toMatch(/^Text is hard to read on this background \(\d\.\d:1, needs 4\.5:1\)\.$/);
  });

  it('asks for 4.5 on the text but only 3 on muted text and the accent', () => {
    const grey = '#8a8a8a';
    const problems = themeProblems('light', { background: '#ffffff', text: grey, muted: grey, accent: grey });

    expect(problems.map((problem) => problem.field)).toEqual(['text']);
  });

  it('are met by the built-in palettes, so a new theme can start from either', () => {
    expect(themeProblems('light', fallbackThemes.light.colors)).toEqual([]);
    expect(themeProblems('dark', fallbackThemes.dark.colors)).toEqual([]);
  });
});
