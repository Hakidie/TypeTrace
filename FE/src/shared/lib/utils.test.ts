import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, cn, getTheme, setTheme } from './utils';

/** Forces the OS-level dark-mode answer used by the `system` theme. */
const mockPrefersDark = (prefersDark: boolean) => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: prefersDark }) as never;
};

afterEach(() => {
  document.documentElement.classList.remove('dark');
});

describe('cn', () => {
  it('merges class names and drops falsy values', () => {
    const isActive: boolean = false;
    expect(cn('a', isActive && 'b', undefined, 'c')).toBe('a c');
  });

  it('lets the last conflicting Tailwind utility win', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-base text-red-500', 'text-lg')).toBe('text-red-500 text-lg');
  });
});

describe('theme helpers', () => {
  it('defaults to the system theme', () => {
    expect(getTheme()).toBe('system');
  });

  it('persists and re-reads the chosen theme', () => {
    mockPrefersDark(false);
    setTheme('dark');
    expect(window.localStorage.getItem('theme')).toBe('dark');
    expect(getTheme()).toBe('dark');
  });

  it('adds the dark class for the dark theme and removes it for light', () => {
    mockPrefersDark(false);

    setTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    setTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('follows the OS preference for the system theme', () => {
    mockPrefersDark(true);
    applyTheme('system');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    mockPrefersDark(false);
    applyTheme('system');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('ignores the OS preference when an explicit theme is set', () => {
    mockPrefersDark(true);
    applyTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
