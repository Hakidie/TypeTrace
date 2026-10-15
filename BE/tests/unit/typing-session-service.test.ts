import { describe, expect, it } from 'vitest';
import {
  computeWpm,
  isSessionCounted,
  MAX_COUNTED_WPM,
  MIN_COUNTED_WORDS
} from '../../src/services/typing-session.service';

describe('isSessionCounted', () => {
  it('counts a session from exactly 20 words and rejects 19', () => {
    expect(isSessionCounted(MIN_COUNTED_WORDS, 50)).toBe(true);
    expect(isSessionCounted(MIN_COUNTED_WORDS - 1, 50)).toBe(false);
  });

  it('counts up to exactly 200 WPM and rejects anything above', () => {
    expect(isSessionCounted(30, MAX_COUNTED_WPM)).toBe(true);
    expect(isSessionCounted(30, MAX_COUNTED_WPM + 0.1)).toBe(false);
  });
});

describe('computeWpm', () => {
  it('is correct words per minute, rounded to one decimal', () => {
    expect(computeWpm(20, 60_000)).toBe(20);
    expect(computeWpm(23, 120_000)).toBe(11.5);
  });

  it('treats anything under one second as one second, so the result stays finite', () => {
    expect(computeWpm(10, 0)).toBe(600);
    expect(computeWpm(10, 1000)).toBe(600);
  });
});
