import { describe, expect, it } from 'vitest';
import { MODE_STEPS, nextTourMode, pendingGuide, TOUR_ORDER } from './steps';

describe('tutorial steps', () => {
  it('never guides an account from before the tutorial', () => {
    expect(pendingGuide(undefined, 'rain')).toBe(false);
  });

  it('guides a mode not learned yet, also after the tour was skipped', () => {
    expect(pendingGuide({ tour: 'skipped', modes: {} }, 'rain')).toBe(true);
    expect(pendingGuide({ tour: 'skipped', modes: { rain: 'skipped' } }, 'rain')).toBe(false);
    expect(pendingGuide({ tour: 'done', modes: { rain: 'done' } }, 'rain')).toBe(false);
  });

  it('walks the tour in order while it is active', () => {
    expect(TOUR_ORDER).toEqual(['practice', 'placement', 'rain', 'daily', 'rank']);
    expect(nextTourMode({ tour: 'active', modes: {} })).toBe('practice');
    expect(nextTourMode({ tour: 'active', modes: { practice: 'done', placement: 'skipped' } })).toBe('rain');
    expect(nextTourMode({ tour: 'skipped', modes: {} })).toBeUndefined();
    expect(nextTourMode(undefined)).toBeUndefined();
  });

  it('gives every mode 3 to 5 steps, the rank one ending with the practice duel', () => {
    for (const mode of TOUR_ORDER) {
      expect(MODE_STEPS[mode].length).toBeGreaterThanOrEqual(3);
      expect(MODE_STEPS[mode].length).toBeLessThanOrEqual(5);
      expect(MODE_STEPS[mode].every((step) => step.mode === mode)).toBe(true);
    }
    expect(MODE_STEPS.rank.at(-1)).toMatchObject({ id: 'rank-practice', next: 'Đấu tập với Ping' });
    expect(MODE_STEPS.rain.some((step) => step.waitFor === 'rain-word')).toBe(true);
  });
});
