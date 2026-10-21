import { describe, expect, it } from 'vitest';
import { THEME_LIST } from '../../src/data/themes';
import { contrastProblems, contrastRatio, isDarkBackground } from '../../src/utils/theme-colors';

const midnight = { background: '#0b1020', text: '#e6ebff', muted: '#8f9bc9', accent: '#6d8bff' };

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for the same color', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#336699', '#336699')).toBe(1);
  });

  it('does not depend on the order of the colors', () => {
    expect(contrastRatio('#0b1020', '#e6ebff')).toBe(contrastRatio('#e6ebff', '#0b1020'));
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

describe('contrastProblems', () => {
  it('is empty for a readable theme', () => {
    expect(contrastProblems(midnight)).toEqual([]);
  });

  it('names each color that is hard to read, with its ratio', () => {
    const problems = contrastProblems({ ...midnight, text: '#222a44', accent: '#10182e' });

    expect(problems.map((problem) => problem.field)).toEqual(['text', 'accent']);
    expect(problems[0].message).toMatch(/^Text is hard to read on this background \(\d\.\d:1, needs 4\.5:1\)$/);
  });

  it('asks for 4.5 on the text but only 3 on muted text and the accent', () => {
    // 3.9:1 passes for muted text and the accent but fails for the text.
    const grey = '#8a8a8a';
    const problems = contrastProblems({ background: '#ffffff', text: grey, muted: grey, accent: grey });

    expect(problems.map((problem) => problem.field)).toEqual(['text']);
  });
});

describe('the starter themes', () => {
  it('are all readable and have unique names', () => {
    for (const theme of THEME_LIST) expect(contrastProblems(theme.colors), theme.name).toEqual([]);
    expect(new Set(THEME_LIST.map((theme) => theme.name.toLowerCase())).size).toBe(THEME_LIST.length);
  });

  it('offer both dark and light themes', () => {
    const dark = THEME_LIST.filter((theme) => isDarkBackground(theme.colors.background));

    expect(dark.length).toBeGreaterThan(0);
    expect(dark.length).toBeLessThan(THEME_LIST.length);
  });
});
