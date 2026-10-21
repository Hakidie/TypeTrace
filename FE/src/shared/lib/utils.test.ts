import { describe, expect, it } from 'vitest';
import { cn } from './utils';

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
