import { describe, expect, it } from 'vitest';
import { passwordStrength } from './password-strength';

describe('passwordStrength', () => {
  it('is 0 for an empty or too short password', () => {
    expect(passwordStrength('')).toBe(0);
    expect(passwordStrength('abc12')).toBe(0);
  });

  it('is weak for letters only', () => {
    expect(passwordStrength('abcdef')).toBe(1);
  });

  it('grows with length, case, digits and symbols', () => {
    expect(passwordStrength('abcdefgh')).toBe(1);
    expect(passwordStrength('abcdefg1')).toBe(2);
    expect(passwordStrength('Abcdefg1')).toBe(3);
    expect(passwordStrength('Abcdefg1!')).toBe(4);
  });

  it('caps at 4', () => {
    expect(passwordStrength('Correct-Horse-Battery-9')).toBe(4);
  });
});
