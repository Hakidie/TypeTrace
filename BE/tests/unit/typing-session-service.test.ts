import { describe, expect, it } from 'vitest';
import {
  computeWpm,
  isSessionCounted,
  MAX_COUNTED_WPM,
  MAX_SESSION_MS,
  SESSION_GRACE_MS,
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

describe('isSessionCounted time limit', () => {
  it('counts a session up to the limit plus the grace and rejects a longer one', () => {
    expect(isSessionCounted(30, 50, MAX_SESSION_MS)).toBe(true);
    expect(isSessionCounted(30, 50, MAX_SESSION_MS + SESSION_GRACE_MS)).toBe(true);
    expect(isSessionCounted(30, 50, MAX_SESSION_MS + SESSION_GRACE_MS + 1)).toBe(false);
  });

  it('is 3 minutes', () => {
    expect(MAX_SESSION_MS).toBe(180_000);
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
