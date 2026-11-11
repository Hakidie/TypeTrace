import { describe, expect, it } from 'vitest';
import { UNPLAYED_DUEL_REASONS } from '../../src/config/minigames';
import { countsAsPlayed } from '../../src/services/minigame-times.service';

const finished = { status: 'finished', flagged: false } as const;

describe('countsAsPlayed', () => {
  it('counts a finished duel for a player who won, lost or drew', () => {
    for (const result of ['win', 'loss', 'draw'] as const) {
      expect(countsAsPlayed(finished, { result })).toBe(true);
    }
  });

  it('does not count a player who forfeited or has no result', () => {
    expect(countsAsPlayed(finished, { result: 'forfeit' })).toBe(false);
    expect(countsAsPlayed(finished, {})).toBe(false);
  });

  it('does not count a match that is not finished or was flagged', () => {
    expect(countsAsPlayed({ status: 'running', flagged: false }, { result: 'win' })).toBe(false);
    expect(countsAsPlayed({ status: 'cancelled', flagged: false }, { result: 'win' })).toBe(false);
    expect(countsAsPlayed({ status: 'finished', flagged: true }, { result: 'win' })).toBe(false);
  });

  it('does not count a duel that was never really played, but counts one the pair limit left unrated', () => {
    for (const unratedReason of UNPLAYED_DUEL_REASONS) {
      expect(countsAsPlayed({ ...finished, unratedReason }, { result: 'draw' })).toBe(false);
    }
    expect(UNPLAYED_DUEL_REASONS).toEqual(['not-started', 'interrupted', 'abandoned']);
    expect(countsAsPlayed({ ...finished, unratedReason: 'pair-limit' }, { result: 'win' })).toBe(true);
  });
});
