import { afterEach, describe, expect, it } from 'vitest';
import { applyStoredTheme, applyTheme, clearAppliedTheme, getStoredTheme, paintTheme, readCurrentColors } from './theme';

const colors = { background: '#0b1020', text: '#e6ebff', muted: '#8f9bc9', accent: '#6d8bff' };
const root = document.documentElement;

afterEach(() => {
  root.classList.remove('dark');
  root.removeAttribute('style');
});

describe('paintTheme', () => {
  it('sets the four colors and the dark class for a theme', () => {
    paintTheme('dark', colors);

    expect(root).toHaveClass('dark');
    expect(root.style.getPropertyValue('--theme-background')).toBe('#0b1020');
    expect(root.style.getPropertyValue('--theme-accent')).toBe('#6d8bff');
  });

  it('removes the colors without a theme, so the built-in palette of the mode shows', () => {
    paintTheme('dark', colors);

    paintTheme('light', null);

    expect(root).not.toHaveClass('dark');
    expect(root.style.getPropertyValue('--theme-background')).toBe('');
  });
});

describe('the remembered theme', () => {
  it('starts in dark mode with no colors', () => {
    expect(getStoredTheme()).toEqual({ mode: 'dark', colors: null });
  });

  it('is saved by applyTheme and shown again by applyStoredTheme', () => {
    applyTheme('light', colors);
    root.removeAttribute('style');
    root.classList.add('dark');

    applyStoredTheme();

    expect(getStoredTheme()).toEqual({ mode: 'light', colors });
    expect(root).not.toHaveClass('dark');
    expect(root.style.getPropertyValue('--theme-text')).toBe('#e6ebff');
  });

  it('ignores a value it cannot read, such as the old Light / Dark / System setting', () => {
    localStorage.setItem('theme-state', 'system');
    expect(getStoredTheme()).toEqual({ mode: 'dark', colors: null });

    localStorage.setItem('theme-state', JSON.stringify({ mode: 'light', colors: { ...colors, accent: 'red' } }));
    expect(getStoredTheme()).toEqual({ mode: 'light', colors: null });
  });

  it('forgets the colors on logout but keeps the mode', () => {
    applyTheme('light', colors);

    clearAppliedTheme();

    expect(getStoredTheme()).toEqual({ mode: 'light', colors: null });
    expect(root.style.getPropertyValue('--theme-background')).toBe('');
  });
});

describe('readCurrentColors', () => {
  it('reads the colors on the page', () => {
    paintTheme('dark', colors);
    expect(readCurrentColors('dark')).toEqual(colors);
  });

  it('answers the built-in palette of the mode when the page has none', () => {
    expect(readCurrentColors('light').background).toBe('#f4ead8');
    expect(readCurrentColors('dark').background).toBe('#140606');
  });
});
